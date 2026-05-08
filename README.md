# PDF to Markdown

**Publisher:** RuslanKain  
**Repository:** [RuslanKain/pdf-to-md](https://github.com/RuslanKain/pdf-to-md)  
**Version:** 0.2.2

Convert PDF files into clean, structured Markdown directly inside VS Code.  
Supports text-only PDFs, academic / research papers, and **extracts and embeds figures inline**.

---

## Features

- **MuPDF WASM engine** (default) — fast, dependency-free, runs entirely in-process.
- **Image extraction** — figures are saved to a `<pdfStem>.assets/` folder and linked inline.
- **Caption auto-detection** — lines matching `Figure N`, `Fig. N`, or `Table N` become image alt text.
- **Heading / bold / italic / code detection** via per-character font metrics.
- **Table detection** — heuristic column alignment (pdfjs engine).
- **Line merging** — broken paragraphs from multi-column layouts are rejoined.
- **pdfjs legacy engine** — original heuristic pipeline, kept for compatibility.
- **Python sidecar engine** *(optional)* — shells out to `pymupdf4llm` for highest-fidelity research-paper output.

---

## Engines

Set `pdfToMarkdown.engine` to choose the extraction backend:

| Engine | How it works | Best for |
|--------|-------------|----------|
| `mupdf` *(default)* | Bundled MuPDF WASM — no Python needed. Extracts text spans with font metadata and embedded images. | Most PDFs, research papers, technical documents |
| `pdfjs` | Legacy `pdfjs-dist` heuristic pipeline (original fork behavior). | Simple PDFs where MuPDF output needs debugging |
| `pythonSidecar` | Shells out to `scripts/convert_pdfs_to_md.py` using `pymupdf4llm`. | Highest fidelity on complex academic papers (requires Python + `pymupdf4llm`) |

**MuPDF is the default and recommended engine for research papers.**

---

## Image Handling

When the MuPDF engine converts a PDF, images are saved to a sibling folder:

```
paper.pdf          → paper.md
paper.assets/
  page-1-img-0.png
  page-2-img-0.png
  page-2-img-1.png
```

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pdfToMarkdown.extractImages` | `"inline"` | `"inline"` = write images **and** insert links. `"folder-only"` = write images, no links. `"none"` = skip. |
| `pdfToMarkdown.imageFormat` | `"png"` | `"png"` or `"jpg"` |
| `pdfToMarkdown.imageMinSize` | `32` | Minimum width/height in pixels; smaller images are skipped. |

### Caption auto-detection

If the block immediately after an image starts with `Figure N`, `Fig. N`, or `Table N`:

```markdown
![Figure 3: Architecture overview](paper.assets/page-4-img-0.png)
*Figure 3: Architecture overview*
```

---

## Python Sidecar Engine

For the highest-fidelity output on academic papers:

1. Install Python packages:
   ```bash
   pip install pymupdf pymupdf4llm
   ```
2. Set `"pdfToMarkdown.engine": "pythonSidecar"` in VS Code settings.
3. Optionally set `"pdfToMarkdown.pythonPath"` if `python` is not on your PATH.

> **Note:** When using `pythonSidecar`, the `extractImages`, `imageFormat`, and `imageMinSize` settings have no effect.

---

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `pdfToMarkdown.engine` | `"mupdf"` | Extraction engine |
| `pdfToMarkdown.extractImages` | `"inline"` | Image extraction mode |
| `pdfToMarkdown.imageFormat` | `"png"` | Image output format |
| `pdfToMarkdown.imageMinSize` | `32` | Minimum image dimension in pixels |
| `pdfToMarkdown.pythonPath` | `""` | Python interpreter path (pythonSidecar only) |
| `pdfToMarkdown.preserveLayout` | `false` | Preserve original line breaks |
| `pdfToMarkdown.detectTables` | `true` | Heuristic table detection (pdfjs engine) |
| `pdfToMarkdown.mergeLines` | `true` | Merge line fragments into paragraphs |
| `pdfToMarkdown.outputFolder` | `""` | Output folder (empty = same as source PDF) |

---

## Architecture

```
src/
├── extension.ts                  VS Code activation
├── commands/
│   └── convert-command.ts        Command handler (only file importing vscode)
├── models/
│   ├── types.ts                  Shared TypeScript types (BBox, Block, etc.)
│   └── errors.ts                 PdfExtractionError + ErrorCode enum
├── services/
│   ├── mupdf-extractor.ts        MuPDF WASM engine (primary)
│   ├── image-extractor.ts        Write images to disk, return relative paths
│   ├── python-sidecar.ts         Spawn python + read resulting .md
│   ├── pdf-extractor.ts          pdfjs-dist engine (legacy)
│   ├── text-normalizer.ts        Normalize pdfjs text items into lines
│   ├── table-detector.ts         Heuristic table detection
│   ├── markdown-transformer.ts   Transform lines/blocks → Markdown
│   └── conversion-pipeline.ts   Engine selection + pipeline orchestration
└── utils/
    └── font-utils.ts             Font name → bold/italic/monospace

scripts/
├── convert_pdfs_to_md.py         Standalone Python script (pythonSidecar engine)
└── README.md                     Script usage docs
```

---

## Known Limitations

- **No OCR** — scanned (image-only) PDFs produce empty output. Run OCR first.
- **Complex multi-column layouts** — may interleave columns. The Python sidecar handles these better.
- **Encrypted PDFs** — not supported.
- **Python sidecar** — requires a local Python install with `pymupdf4llm`.

---

## Development

```bash
npm install
npm run compile    # TypeScript type check
npm run build      # esbuild bundle
npm run test:unit  # Vitest unit tests (no VS Code needed)
npm run test       # Unit + integration tests
npm run package    # Produce .vsix
```
