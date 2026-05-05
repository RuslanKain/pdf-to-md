"""
Convert one PDF file to Markdown.

Uses pymupdf4llm to extract structured Markdown from native digital PDFs,
preserving headings, tables, and formatting.

Falls back to plain PyMuPDF text extraction for files where pymupdf4llm hangs
or crashes.

Usage:
    python convert_pdfs_to_md.py "C:\\absolute\\path\\to\\paper.pdf"

Output: creates a .md file with the same name in the same folder as the PDF.
"""

import pathlib
import sys
import threading

import pymupdf
import pymupdf4llm

# Timeout in seconds per file for pymupdf4llm.
TIMEOUT_SECONDS = 120


def extract_plain(pdf_path: pathlib.Path) -> str:
    """Fallback: extract plain text page-by-page with pymupdf."""
    doc = pymupdf.open(str(pdf_path))
    pages = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return f"# {pdf_path.stem}\n\n" + "\n\n---\n\n".join(pages)


def extract_with_timeout(pdf_path: pathlib.Path, timeout: int) -> str | None:
    """Try pymupdf4llm with a thread-based timeout."""
    result = [None]
    error = [None]

    def worker():
        try:
            result[0] = pymupdf4llm.to_markdown(str(pdf_path))
        except Exception as e:
            error[0] = e

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        return None
    if error[0]:
        raise error[0]
    return result[0]


def get_pdf_path() -> pathlib.Path:
    """Read and validate the PDF path passed as the first argument."""
    if len(sys.argv) < 2:
        script_name = pathlib.Path(sys.argv[0]).name
        print(f'Usage: python {script_name} "C:\\absolute\\path\\to\\paper.pdf"')
        sys.exit(2)

    pdf_path = pathlib.Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.is_file():
        print(f"Error: PDF file does not exist: {pdf_path}")
        sys.exit(1)
    if pdf_path.suffix.lower() != ".pdf":
        print(f"Error: expected a .pdf file, got: {pdf_path}")
        sys.exit(1)

    return pdf_path


def convert_pdf(pdf_path: pathlib.Path) -> pathlib.Path:
    """Convert a single PDF and write the Markdown file beside it."""
    out_path = pdf_path.with_suffix(".md")

    if out_path.exists():
        print(f"SKIP (already exists): {out_path}")
        return out_path

    print(f"Converting: {pdf_path} ... ", end="", flush=True)
    try:
        md_text = extract_with_timeout(pdf_path, TIMEOUT_SECONDS)
        if md_text is None:
            print(f"TIMEOUT ({TIMEOUT_SECONDS}s), falling back to plain ... ", end="", flush=True)
            md_text = extract_plain(pdf_path)
            out_path.write_text(md_text, encoding="utf-8")
            print(f"OK (plain, {len(md_text):,} chars)")
        else:
            out_path.write_text(md_text, encoding="utf-8")
            print(f"OK  ({len(md_text):,} chars)")
    except KeyboardInterrupt:
        print("INTERRUPTED")
        sys.exit(130)
    except BaseException as e:
        print(f"pymupdf4llm failed ({type(e).__name__}), trying plain ... ", end="", flush=True)
        try:
            md_text = extract_plain(pdf_path)
            out_path.write_text(md_text, encoding="utf-8")
            print(f"OK (plain, {len(md_text):,} chars)")
        except Exception as e2:
            print(f"FAILED: {e2}")
            sys.exit(1)

    return out_path


def main() -> None:
    pdf_path = get_pdf_path()
    out_path = convert_pdf(pdf_path)
    print(f"\nDone. Markdown file is at {out_path}")


if __name__ == "__main__":
    main()
