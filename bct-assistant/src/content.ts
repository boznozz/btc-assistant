/**
 * Content script — document-aware BCT Legal Assistant panel.
 * Builds a per-PDF index, supports direct .pdf tabs, and sends documents[] to the backend.
 */

import {
  DocumentContext,
  documentsForAsk,
  findPdfSources,
  isDirectPdfPage,
  loadAllDocuments,
} from "./pdf";

let panelEl: HTMLElement | null = null;
let messagesEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let docsEl: HTMLElement | null = null;
let inputEl: HTMLInputElement | null = null;
let sendBtn: HTMLButtonElement | null = null;
let toggleBtn: HTMLButtonElement | null = null;

let loadedDocuments: DocumentContext[] = [];
let usedDemoCorpus = false;
let demoFailedLiveCount = 0;
let knownPdfUrls = new Set<string>();
let isAsking = false;
let isScanning = false;
let scanQueued = false;
let rescanTimer: number | null = null;
let announcedInitial = false;

function createPanel(): void {
  if (document.getElementById("bct-assistant-panel")) {
    return;
  }

  // Chrome PDF viewer may briefly lack a body
  if (!document.body) {
    document.documentElement.appendChild(document.createElement("body"));
  }

  panelEl = document.createElement("div");
  panelEl.id = "bct-assistant-panel";
  panelEl.innerHTML = `
    <div class="panel-header" id="bct-panel-drag">
      <span class="title">BCT Legal Assistant</span>
      <div class="panel-header-actions">
        <button type="button" id="bct-clear-btn" title="Clear conversation">↺</button>
        <button type="button" id="bct-close-btn" title="Close">×</button>
      </div>
    </div>
    <div class="panel-status" id="bct-status">Scanning page for legal PDFs…</div>
    <div class="panel-docs" id="bct-docs"></div>
    <div class="chat-messages" id="bct-messages"></div>
    <div class="panel-input">
      <input type="text" id="bct-user-input" placeholder="Ask about a document (e.g. caisse1.pdf)…" autocomplete="off" />
      <button type="button" id="bct-send-btn">Send</button>
    </div>
    <div class="panel-footer">
      <strong>Agency Benefit:</strong> Deflects ~60% of routine MSME legal queries —
      ~48 agent-hours saved / month at BCT (est.).
    </div>
  `;
  document.body.appendChild(panelEl);

  toggleBtn = document.createElement("button");
  toggleBtn.id = "bct-assistant-toggle";
  toggleBtn.type = "button";
  toggleBtn.title = "Open BCT Legal Assistant";
  toggleBtn.textContent = "§";
  document.body.appendChild(toggleBtn);

  messagesEl = document.getElementById("bct-messages");
  statusEl = document.getElementById("bct-status");
  docsEl = document.getElementById("bct-docs");
  inputEl = document.getElementById("bct-user-input") as HTMLInputElement;
  sendBtn = document.getElementById("bct-send-btn") as HTMLButtonElement;

  document.getElementById("bct-close-btn")?.addEventListener("click", () => {
    panelEl?.classList.add("bct-hidden");
    toggleBtn?.classList.add("visible");
  });

  toggleBtn.addEventListener("click", () => {
    panelEl?.classList.remove("bct-hidden");
    toggleBtn?.classList.remove("visible");
  });

  document.getElementById("bct-clear-btn")?.addEventListener("click", clearConversation);
  sendBtn?.addEventListener("click", () => void askQuestion());
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void askQuestion();
    }
  });

  makeDraggable(panelEl, document.getElementById("bct-panel-drag"));
}

function setStatus(msg: string): void {
  if (statusEl) statusEl.textContent = msg;
}

function appendMessage(text: string, kind: "bot" | "user" | "thinking" | "error"): HTMLElement {
  const el = document.createElement("div");
  el.className = `message ${kind}`;
  el.textContent = text;
  messagesEl?.appendChild(el);
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function clearConversation(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = "";
  announceContext(true);
}

function successfulDocs(): DocumentContext[] {
  return loadedDocuments.filter((d) => d.status === "success" && d.text.length > 0);
}

function updatePanelWithDocumentList(): void {
  if (!docsEl) return;

  if (usedDemoCorpus) {
    const n = demoFailedLiveCount || 0;
    docsEl.innerHTML = `<div class="docs-warn">⚠️ Using demo corpus — live PDF fetch failed on ${n} document${n === 1 ? "" : "s"}.</div>`;
    return;
  }

  if (loadedDocuments.length === 0) {
    docsEl.innerHTML = '<div class="docs-empty">No PDF documents detected on this page.</div>';
    return;
  }

  const lines = loadedDocuments
    .map((d) => {
      if (d.status === "pending") {
        return `<div class="doc-pending">⏳ ${escapeHtml(d.filename)} — loading...</div>`;
      }
      if (d.status === "success") {
        return `<div class="doc-ok">✓ ${escapeHtml(d.filename)} (${d.text.length} chars)</div>`;
      }
      const err = d.error ? escapeHtml(d.error.slice(0, 80)) : "failed";
      return `<div class="doc-fail">✗ ${escapeHtml(d.filename)} — ${err}</div>`;
    })
    .join("");
  docsEl.innerHTML = `<div class="docs-title">Detected documents:</div>${lines}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function announceContext(force: boolean): void {
  const ok = successfulDocs();
  const names = ok.map((d) => d.filename);

  if (usedDemoCorpus) {
    const n = demoFailedLiveCount || 0;
    appendMessage(
      `⚠️ Using demo corpus — live PDF fetch failed on ${n} document${n === 1 ? "" : "s"}. Answers are illustrative only.`,
      "error"
    );
    return;
  }

  if (isDirectPdfPage() && names.length === 1) {
    appendMessage(`I'm reading: ${names[0]}`, "bot");
    return;
  }

  if (names.length === 0) {
    if (force) {
      appendMessage(
        "No PDF text loaded yet. Expand an accordion or open a page that lists document links.",
        "bot"
      );
    }
    return;
  }

  const preview =
    names.length <= 8
      ? names.join(", ")
      : names.slice(0, 8).join(", ") + `, … (+${names.length - 8} more)`;

  appendMessage(
    `I've loaded: ${preview} (${names.length} document${names.length === 1 ? "" : "s"}).\nAsk about a specific file (e.g. "what is in ${names[0]}?") or a legal topic.`,
    "bot"
  );
}

async function askQuestion(): Promise<void> {
  if (isAsking || !inputEl || !sendBtn) return;

  const question = inputEl.value.trim();
  if (!question) return;

  const docs = documentsForAsk(loadedDocuments);
  if (docs.length === 0) {
    appendMessage(
      "No extracted PDF text is available yet. Wait for detection to finish or open a page with PDFs.",
      "error"
    );
    return;
  }

  isAsking = true;
  sendBtn.disabled = true;
  inputEl.value = "";
  appendMessage(question, "user");
  const thinking = appendMessage("Thinking…", "thinking");

  try {
    const answer = await sendAskToBackground(question, docs);
    thinking.remove();
    appendMessage(answer, "bot");
  } catch (err) {
    thinking.remove();
    const msg = err instanceof Error ? err.message : String(err);
    // Prefer excerpt from a document named in the question, else first success
    const named = loadedDocuments.find(
      (d) =>
        d.status === "success" &&
        d.filename &&
        question.toLowerCase().includes(d.filename.toLowerCase().replace(/\.pdf$/i, ""))
    );
    const source = named || successfulDocs()[0];
    const excerpt = (source?.text || "").substring(0, 2000).trim();
    const label = source?.filename || "document";
    appendMessage(
      `AI unavailable (${msg}).\n\nExcerpt from ${label}:\n\n${excerpt}${
        (source?.text.length || 0) > 2000 ? "…" : ""
      }`,
      "bot"
    );
  } finally {
    isAsking = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function sendAskToBackground(
  question: string,
  documents: { name: string; text: string }[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "ASK_AI", question, documents }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown backend error"));
        return;
      }
      resolve(response.answer as string);
    });
  });
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement | null): void {
  if (!handle) return;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let dragging = false;

  handle.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    startX = e.clientX;
    startY = e.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panel.style.left = `${originLeft + (e.clientX - startX)}px`;
    panel.style.top = `${originTop + (e.clientY - startY)}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

async function refreshContext(opts: { force?: boolean; announce?: boolean } = {}): Promise<void> {
  if (isScanning) {
    scanQueued = true;
    return;
  }
  isScanning = true;

  try {
    const current = findPdfSources();
    const newUrls = current.filter((s) => !knownPdfUrls.has(s.url));

    if (!opts.force && newUrls.length === 0 && loadedDocuments.length > 0) {
      return;
    }

    setStatus("Scanning page for legal PDFs…");
    const result = await loadAllDocuments(setStatus, (docs) => {
      loadedDocuments = docs;
      usedDemoCorpus = false;
      updatePanelWithDocumentList();
    });
    loadedDocuments = result.documents;
    usedDemoCorpus = result.usedDemoCorpus;
    demoFailedLiveCount = result.failedLiveCount;
    knownPdfUrls = new Set(
      loadedDocuments.filter((d) => !d.url.startsWith("demo://")).map((d) => d.url)
    );

    updatePanelWithDocumentList();

    const ok = successfulDocs();
    if (usedDemoCorpus) {
      setStatus(`⚠️ Demo corpus — live fetch failed on ${demoFailedLiveCount} doc(s)`);
    } else if (ok.length === 0) {
      setStatus("No PDFs extracted");
    } else if (isDirectPdfPage() && ok.length === 1) {
      setStatus(`I'm reading: ${ok[0].filename}`);
    } else {
      setStatus(`${ok.length} document(s) ready`);
    }

    const shouldAnnounce = opts.announce !== false && (opts.force || !announcedInitial || newUrls.length > 0);
    if (shouldAnnounce) {
      announceContext(!!opts.force);
      announcedInitial = true;
    }
  } catch (err) {
    console.error("[BCT Assistant] refreshContext failed:", err);
    setStatus("Extraction error");
  } finally {
    isScanning = false;
    if (scanQueued) {
      scanQueued = false;
      void refreshContext({ force: false, announce: true });
    }
  }
}

function scheduleRescan(delayMs: number): void {
  if (rescanTimer !== null) window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    rescanTimer = null;
    void refreshContext({ force: false, announce: true });
  }, delayMs);
}

function watchForLazyPdfs(): void {
  if (isDirectPdfPage()) return; // single-doc tab — no DOM accordion

  const observer = new MutationObserver(() => scheduleRescan(300));
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("#bct-assistant-panel, #bct-assistant-toggle")) return;
      scheduleRescan(500);
    },
    true
  );
}

async function init(): Promise<void> {
  createPanel();
  await refreshContext({ force: true, announce: true });
  watchForLazyPdfs();
}

console.log("[BCT Assistant] Content script loaded on", location.href);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void init());
} else {
  void init();
}
