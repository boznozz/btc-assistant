"""
BCT Legal Assistant — FastAPI backend
POST /ask  { question, documents: [{name, text}] } → { answer }
Uses Groq (OpenAI-compatible API). Set GROQ_API_KEY in backend/.env
"""

from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

app = FastAPI(title="BCT Legal Assistant API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are a legal assistant for Tunisian MSMEs. "
    "You have access to named documents extracted from the BCT website. "
    "Answer questions based ONLY on these documents. "
    "Cite the specific document name and article number when possible. "
    "If the user asks about a specific document (e.g. 'caisse1.pdf' or 'Loi_2016_48'), "
    "search THAT document first and focus on it. "
    "If asked 'what is this document?' or similar: "
    "describe the loaded document(s); if several are loaded, briefly summarize each "
    "or ask which one they mean. "
    "If the answer spans multiple documents, say so. "
    "If you cannot find the answer, say "
    "'I cannot find this in the provided documents.' "
    "Keep answers clear and actionable. Reply in French or English to match the question."
)

_stats: dict[str, Any] = {
    "queries_today": 0,
    "total_ms": 0,
    "unanswered": [],
    "recent": [],
}


class Document(BaseModel):
    name: str
    text: str = ""


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    documents: list[Document] = Field(default_factory=list)
    # Backward compatible with older extension builds
    context: str = Field(default="")


class AskResponse(BaseModel):
    answer: str


def _build_context(body: AskRequest) -> str:
    parts: list[str] = []
    for doc in body.documents:
        if doc.text.strip():
            parts.append(f"=== DOCUMENT: {doc.name} ===\n{doc.text[:4000]}")
    if parts:
        return "\n\n".join(parts)
    # Legacy flat context
    return body.context.strip()


def _call_llm(question: str, context: str, doc_names: list[str]) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not set. Copy backend/.env.example to backend/.env",
        )

    from openai import OpenAI

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    names_line = ", ".join(doc_names) if doc_names else "(unnamed context)"
    completion = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Loaded documents: {names_line}\n\n"
                    f"Documents:\n{context}\n\n"
                    f"Question: {question}"
                ),
            },
        ],
    )
    return (completion.choices[0].message.content or "").strip()


def _record(question: str, answer: str, ms: float) -> None:
    _stats["queries_today"] += 1
    _stats["total_ms"] += ms
    unanswered = "cannot find this" in answer.lower()
    if unanswered:
        _stats["unanswered"].append(question)
    _stats["recent"].insert(
        0,
        {
            "question": question,
            "answer_preview": answer[:160],
            "ms": round(ms),
            "flagged": unanswered,
        },
    )
    _stats["recent"] = _stats["recent"][:50]
    _stats["unanswered"] = _stats["unanswered"][-20:]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/stats")
def stats() -> dict[str, Any]:
    n = _stats["queries_today"]
    avg = round(_stats["total_ms"] / n) if n else 0
    top_unanswered = _stats["unanswered"][-1] if _stats["unanswered"] else "—"
    return {
        "queries_today": n,
        "avg_response_ms": avg,
        "top_unanswered": top_unanswered,
        "agency_benefit": {
            "est_hours_saved_per_month": 48,
            "deflection_rate_pct": 60,
            "note": (
                "Conservative estimate: BCT agents spend ~20h/week on routine MSME "
                "legal/regulatory questions; tool deflects ~60% → ~48h/month."
            ),
        },
        "recent": _stats["recent"],
    }


@app.post("/ask", response_model=AskResponse)
def ask(body: AskRequest) -> AskResponse:
    context = _build_context(body)
    if not context:
        return AskResponse(
            answer=(
                "I cannot find this in the provided documents. "
                "(No PDF text was sent — open a BCT page with documents first.)"
            )
        )

    doc_names = [d.name for d in body.documents if d.text.strip()]
    started = time.perf_counter()
    try:
        answer = _call_llm(body.question, context, doc_names)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM provider error: {exc}") from exc

    ms = (time.perf_counter() - started) * 1000
    _record(body.question, answer, ms)
    return AskResponse(answer=answer)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
