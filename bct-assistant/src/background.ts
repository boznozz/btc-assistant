/**
 * Background service worker (Manifest V3).
 * Proxies AI requests and fetches PDF bytes (no pdfjs — workers disallowed here).
 */

const BACKEND_URL = "http://localhost:8000/ask";
const LOG_KEY = "query_log";
const MAX_LOG = 100;

chrome.runtime.onInstalled.addListener(() => {
  console.log("[BCT Assistant] Extension installed");
  chrome.storage.local.set({ enabled: true, query_log: [] });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ASK_AI") {
    void handleAskAi(
      message.question as string,
      (message.documents as { name: string; text: string }[]) || [],
      message.context as string | undefined
    )
      .then((answer) => sendResponse({ ok: true, answer }))
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error });
      });
    return true;
  }

  if (message.type === "FETCH_PDF_TEXT") {
    void handleFetchPdf(message.url as string)
      .then((base64) => sendResponse({ ok: true, base64 }))
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err);
        console.error("[BCT BG] Fetch error:", err);
        sendResponse({ ok: false, error });
      });
    return true; // keep channel open for async sendResponse
  }

  if (message.type === "GET_QUERY_LOG") {
    chrome.storage.local.get([LOG_KEY], (result) => {
      sendResponse({ ok: true, log: result[LOG_KEY] || [] });
    });
    return true;
  }

  return false;
});

async function handleAskAi(
  question: string,
  documents: { name: string; text: string }[],
  legacyContext?: string
): Promise<string> {
  const started = Date.now();

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      documents,
      context: legacyContext || "",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Backend HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { answer?: string };
  const answer = data.answer ?? "";
  const ms = Date.now() - started;

  await appendQueryLog({
    question,
    answerPreview: answer.substring(0, 120),
    ms,
    at: new Date().toISOString(),
  });

  return answer;
}

/** Fetch PDF bytes and return base64 (reliable across sendMessage; ArrayBuffer often arrives empty). */
async function handleFetchPdf(url: string): Promise<string> {
  console.log("[BCT BG] Fetching:", url);

  const res = await fetch(url, {
    credentials: "omit",
    headers: {
      Accept: "application/pdf,*/*",
    },
  });

  console.log("[BCT BG] Response status:", res.status);
  console.log("[BCT BG] Content-Type:", res.headers.get("content-type"));

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  console.log("[BCT BG] Byte length:", buffer.byteLength);

  if (buffer.byteLength === 0) {
    throw new Error("Empty response body (0 bytes)");
  }

  return arrayBufferToBase64(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...slice));
  }
  return btoa(chunks.join(""));
}

interface QueryLogEntry {
  question: string;
  answerPreview: string;
  ms: number;
  at: string;
}

async function appendQueryLog(entry: QueryLogEntry): Promise<void> {
  const result = await chrome.storage.local.get([LOG_KEY]);
  const log: QueryLogEntry[] = Array.isArray(result[LOG_KEY]) ? result[LOG_KEY] : [];
  log.unshift(entry);
  await chrome.storage.local.set({ [LOG_KEY]: log.slice(0, MAX_LOG) });
}
