"""
Optional: download BCT PDFs and dump text into src/fallbackTexts.ts keys.
Usage:
  pip install pypdf
  python backend/extract_fallback.py path/to/loi.pdf

Prints extracted text to stdout so you can paste into fallbackTexts.ts.
"""

from __future__ import annotations

import sys
from pathlib import Path

from pypdf import PdfReader


def extract(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        parts.append(f"--- page {i + 1} ---\n{text}")
    return "\n\n".join(parts).strip()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python extract_fallback.py <file.pdf> [file2.pdf ...]", file=sys.stderr)
        sys.exit(1)
    for arg in sys.argv[1:]:
        path = Path(arg)
        print(f"\n===== {path.name} =====\n")
        print(extract(path))


if __name__ == "__main__":
    main()
