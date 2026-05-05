# scripts/README.md

## convert_pdfs_to_md.py

A standalone Python script that converts a single PDF file to Markdown using
[pymupdf4llm](https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/index.html),
which preserves headings, tables, and formatting from native digital PDFs.

### Requirements

```bash
pip install pymupdf pymupdf4llm
```

### Usage

```bash
python scripts/convert_pdfs_to_md.py "path/to/paper.pdf"
```

The script writes a `.md` file with the same base name in the same directory as
the input PDF.

### Behaviour

- Uses `pymupdf4llm.to_markdown()` with a 120-second timeout per file.
- If the timeout is exceeded or `pymupdf4llm` raises an exception, falls back to
  plain `pymupdf` text extraction.
- Skips files where a same-named `.md` already exists.

### Using from the VS Code extension

Set `pdfToMarkdown.engine` to `"pythonSidecar"` in your VS Code settings.
Optionally set `pdfToMarkdown.pythonPath` to the full path of your Python
interpreter if `python` is not on your `PATH`.

> **Note:** When the Python sidecar engine is active, the `extractImages`,
> `imageFormat`, and `imageMinSize` settings have no effect — those controls
> apply only to the MuPDF engine.
