# BCT Legal Assistant

Chrome extension (Manifest V3) for **Hack4Justice 2026** — Challenge A (Regulatory AI & Fiscal Compliance).

Overlays an AI chatbot on [BCT legal pages](https://www.bct.gov.tn/bct/siteprod/page.jsp?id=227), extracts PDF law text **client-side** (no pre-built vector DB), and answers MSME questions with article citations. Includes a mandatory **Institutional Dashboard** for BCT officers.

## Project structure

```
bct-assistant/
├── manifest.json
├── src/
│   ├── content.ts          # Side panel + chat UI
│   ├── content.css
│   ├── background.ts       # Proxies /ask + PDF fetch
│   ├── pdf.ts              # findPdfLinks / extract / cache
│   ├── fallbackTexts.ts    # Demo safety net if WASM fails
│   ├── popup.html / popup.ts
├── backend/
│   ├── main.py             # FastAPI POST /ask
│   ├── requirements.txt
│   ├── .env.example
│   └── extract_fallback.py
├── dashboard/
│   └── index.html          # Institutional Module
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Quick start

### 1. Build the extension

```bash
cd bct-assistant
npm install
npm run build
```

Dev watch mode:

```bash
npm run dev
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Visit https://www.bct.gov.tn/bct/siteprod/page.jsp?id=227  
   Confirm the floating **BCT Legal Assistant** panel appears (Phase 1).

### 3. Run the AI backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # then edit GROQ_API_KEY (https://console.groq.com)
# Linux/macOS: cp .env.example .env

uvicorn main:app --reload --port 8000
```

Smoke-test:

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/ask ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"What about foreign exchange?\",\"context\":\"Article 55 — En matière de change...\"}"
```

### 4. Institutional dashboard

- From the extension popup → **Institutional Dashboard**, or  
- Open `dashboard/index.html` / `dist/dashboard/index.html` in a browser tab.

## Phase checklist — what to test

| Phase | Test |
|-------|------|
| **1** Skeleton | Panel visible on BCT page; close/reopen via § button |
| **2** PDF extract | Console shows `[BCT Assistant] First 500 chars:`; status bar shows PDF count |
| **3** Backend | `curl` `/ask` returns a cited answer |
| **4** E2E | Ask *“What does this law say about foreign exchange?”* → Art. 55/56 style citation |
| **5** Dashboard | KPIs + query table; live refresh if backend is up |
| **6** Polish | “Thinking…”, network errors, clear (↺), drag header, Agency Benefit footer |

## Agency Benefit (pitch slide)

> BCT agents spend ~**20 hours/week** answering routine MSME questions on banking/FX law.  
> This tool deflects ~**60%** of those queries → ~**48 agent-hours saved per month**, with an audit trail instead of paper/email queues.

## Notes

- PDF text is extracted **on-the-fly** with `pdfplumber-wasm` and cached in `chrome.storage.session`.
- If WASM/CORS fails, `fallbackTexts.ts` keeps the demo alive (refresh via `backend/extract_fallback.py`).
- AI calls go through the **background service worker** → `localhost:8000` (avoids page CORS).
- No BCT website changes required.

## License

MIT
