/**
 * PDF discovery + text extraction (pdfjs in content script; fetch via background).
 * No silent fallback masking — callers decide when to use demo corpus.
 */
import * as pdfjsLib from "pdfjs-dist";
import { FALLBACK_PDF_TEXTS } from "./fallbackTexts";

const CACHE_PREFIX = "pdf_";
const MAX_CACHE_CHARS = 200_000;
/** Per-document text cap sent to the LLM */
export const MAX_DOC_CHARS_FOR_LLM = 4000;

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs");

export interface PdfSource {
  url: string;
  filename: string;
}

export interface DocumentContext {
  filename: string;
  url: string;
  text: string;
  status: "success" | "failed" | "pending";
  error?: string;
}

function isPdfCandidate(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\.pdf(\?|#|$)/i.test(value.trim());
}

function resolveUrl(raw: string): string | null {
  try {
    return new URL(raw, window.location.href).href;
  } catch {
    return null;
  }
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const name = decodeURIComponent(path.split("/").pop() || "");
    return name || url;
  } catch {
    return url.split("/").pop() || url;
  }
}

function addSource(map: Map<string, PdfSource>, raw: string | null | undefined): void {
  if (!isPdfCandidate(raw)) return;
  const absolute = resolveUrl(raw!);
  if (!absolute || map.has(absolute)) return;
  map.set(absolute, { url: absolute, filename: filenameFromUrl(absolute) });
}

/** True when the tab URL itself is a PDF (Chrome built-in viewer). */
export function isDirectPdfPage(): boolean {
  return /\.pdf(\?|#|$)/i.test(location.href);
}

/**
 * Detect PDF sources: current URL (if .pdf), anchors, embeds, iframes, objects, data-*.
 */
export function findPdfSources(): PdfSource[] {
  const map = new Map<string, PdfSource>();

  // Direct PDF tab — the page URL is the document
  if (isDirectPdfPage()) {
    addSource(map, location.href);
  }

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    addSource(map, a.getAttribute("href"));
    addSource(map, a.href);
  });

  document.querySelectorAll<HTMLEmbedElement>("embed[src]").forEach((el) => {
    addSource(map, el.getAttribute("src"));
  });

  document.querySelectorAll<HTMLIFrameElement>("iframe[src]").forEach((el) => {
    addSource(map, el.getAttribute("src"));
  });

  document.querySelectorAll<HTMLObjectElement>("object[data]").forEach((el) => {
    addSource(map, el.getAttribute("data"));
  });

  document.querySelectorAll("[data-src], [data-pdf], [data-url]").forEach((el) => {
    addSource(map, el.getAttribute("data-src"));
    addSource(map, el.getAttribute("data-pdf"));
    addSource(map, el.getAttribute("data-url"));
  });

  return Array.from(map.values());
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Ask background to fetch PDF bytes (base64). */
async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "FETCH_PDF_TEXT", url }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok || !response.base64) {
        reject(new Error(response?.error || "Background PDF fetch failed"));
        return;
      }
      resolve(base64ToUint8Array(response.base64 as string));
    });
  });
}

/**
 * Fetch PDF via background, then extract text with PDF.js in the content script.
 * Throws on failure — does NOT substitute fallback text.
 */
export async function extractPdfText(url: string): Promise<string> {
  const bytes = await fetchPdfBytes(url);

  if (bytes.length === 0) {
    throw new Error("Empty PDF buffer after transfer");
  }

  if (bytes.length >= 4) {
    const mag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (mag !== "%PDF") {
      throw new Error(`Not a PDF (magic=${JSON.stringify(mag)})`);
    }
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  const maxPages = Math.min(pdf.numPages, 40);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(pageText);
    if (parts.join("\n\n").length > MAX_CACHE_CHARS) break;
  }

  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new Error("Empty text extracted from PDF");
  }
  return text;
}

export async function getOrExtractText(url: string): Promise<string> {
  const key = CACHE_PREFIX + url;

  try {
    const cached = await chrome.storage.local.get(key);
    if (typeof cached[key] === "string" && cached[key].length > 0) {
      console.log("[BCT] Cache hit for", url);
      return cached[key] as string;
    }
  } catch (e) {
    console.warn("[BCT] storage read failed:", e);
  }

  const text = await extractPdfText(url);
  const toStore = text.substring(0, MAX_CACHE_CHARS);

  try {
    await chrome.storage.local.set({ [key]: toStore });
  } catch (e) {
    console.warn("[BCT] storage write failed:", e);
  }

  return text;
}

/**
 * Extract every detected PDF into a document index.
 * Demo corpus is ONLY used when zero live extractions succeed — and must be labeled by UI.
 */
export async function loadAllDocuments(
  onStatus?: (msg: string) => void,
  onProgress?: (documents: DocumentContext[]) => void
): Promise<{ documents: DocumentContext[]; usedDemoCorpus: boolean; failedLiveCount: number }> {
  const sources = findPdfSources();
  console.log(
    "[BCT] findPdfSources →",
    sources.map((s) => s.filename)
  );

  // Direct PDF tab with empty DOM discovery — still load the page URL
  if (sources.length === 0 && isDirectPdfPage()) {
    sources.push({ url: location.href, filename: filenameFromUrl(location.href) });
  }

  const documents: DocumentContext[] = sources.map((s) => ({
    filename: s.filename,
    url: s.url,
    text: "",
    status: "pending" as const,
  }));

  onProgress?.(documents.map((d) => ({ ...d })));

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    onStatus?.(`Extracting: ${source.filename}…`);
    try {
      const text = await getOrExtractText(source.url);
      documents[i] = {
        filename: source.filename,
        url: source.url,
        text,
        status: "success",
      };
      console.log(`[BCT] Extracted ${text.length} chars from ${source.filename}`);
      console.log("[BCT] First 500 chars:\n", text.substring(0, 500));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[BCT] Failed", source.filename, err);
      documents[i] = {
        filename: source.filename,
        url: source.url,
        text: "",
        status: "failed",
        error,
      };
    }
    onProgress?.(documents.map((d) => ({ ...d })));
  }

  const successCount = documents.filter((d) => d.status === "success").length;
  const failedLiveCount = documents.filter((d) => d.status === "failed").length;

  if (successCount === 0) {
    // Last-resort demo corpus — caller must label this clearly in the UI
    const demoDocs = Object.entries(FALLBACK_PDF_TEXTS).map(([name, text]) => ({
      filename: `[DEMO] ${name}`,
      url: `demo://${name}`,
      text,
      status: "success" as const,
    }));
    if (demoDocs.length > 0) {
      console.warn("[BCT] No live PDFs extracted — using labeled demo corpus");
      return {
        documents: demoDocs,
        usedDemoCorpus: true,
        failedLiveCount: sources.length || failedLiveCount,
      };
    }
  }

  return { documents, usedDemoCorpus: false, failedLiveCount };
}

/** Payload for POST /ask */
export function documentsForAsk(
  documents: DocumentContext[]
): { name: string; text: string }[] {
  return documents
    .filter((d) => d.status === "success" && d.text.length > 0)
    .map((d) => ({
      name: d.filename,
      text: d.text.substring(0, MAX_DOC_CHARS_FOR_LLM),
    }));
}
