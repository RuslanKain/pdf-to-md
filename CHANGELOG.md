# Changelog

All notable changes to **PDF to Markdown** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.1] - 2026-05-05

### Added

- **MuPDF WASM engine** (`pdfToMarkdown.engine: "mupdf"`, new default). Uses the
  official `mupdf` npm package (WASM build of MuPDF) to extract text spans with
  full font metadata (size, bold, italic, monospace) and embedded image blocks
  with their bounding boxes and pixel data.
- **Image extraction** — `src/services/image-extractor.ts` writes each image to
  `<pdfStem>.assets/page-<n>-img-<k>.<ext>` alongside the Markdown file.
- **Inline image links** — images are embedded at their correct reading-order
  position in the Markdown output (`![alt](path)`) when
  `pdfToMarkdown.extractImages` is `"inline"` (default).
- **Caption auto-detection** — if the block immediately after an image matches
  `/^(Figure|Fig\.?|Table)\s+\d+/i`, the line is used as the image alt text and
  emitted as an italic caption directly below the image link.
- **New settings:**
  - `pdfToMarkdown.engine` — `"mupdf"` | `"pdfjs"` | `"pythonSidecar"`
  - `pdfToMarkdown.extractImages` — `"inline"` | `"folder-only"` | `"none"`
  - `pdfToMarkdown.imageFormat` — `"png"` | `"jpg"`
  - `pdfToMarkdown.imageMinSize` — minimum image dimension in pixels (default `32`)
  - `pdfToMarkdown.pythonPath` — path to Python interpreter for sidecar engine
- **Python sidecar engine** (`pdfToMarkdown.engine: "pythonSidecar"`) — shells out
  to the bundled `scripts/convert_pdfs_to_md.py` script using `pymupdf4llm` for
  the highest-fidelity conversion of academic research papers.
- **Bundled Python script** — `scripts/convert_pdfs_to_md.py` with a timeout,
  fallback to plain PyMuPDF extraction, and a companion `scripts/README.md`.
- **New error codes** — `MUPDF_INIT_FAILED`, `IMAGE_WRITE_FAILED`,
  `PYTHON_NOT_FOUND`, `PYTHON_SCRIPT_FAILED`.
- **New unit tests** — `rich-transformer.test.ts` (block interleaving, caption
  detection, `extractImages` modes) and `image-extractor.test.ts`
  (`imageMinSize` filter, idempotency, multi-page filenames).
- **CI workflow** — `.github/workflows/ci.yml` runs lint, compile, unit tests,
  and build on every push/PR to `main`; produces a `.vsix` artifact on `v*` tags.

### Changed

- **Rebranded** — `name: pdf-to-md`, `publisher: RuslanKain`,
  `displayName: "PDF to Markdown"`, `version: 0.2.1`.
- **Repository URL** updated to `https://github.com/RuslanKain/pdf-to-md`.
- **`ConversionOptions`** extended with `engine`, `extractImages`, `imageFormat`,
  `imageMinSize`, `pythonPath`, and `outputDir` fields.
- **`ConversionConfiguration`** extended with the same five new settings.
- **`esbuild.mjs`** — `mupdf` added to the `external` list (shipped in
  `node_modules/mupdf` rather than bundled, because mupdf is ESM with top-level
  await).
- **`.vscodeignore`** — added `!node_modules/mupdf/**` so the mupdf package
  (including its WASM binary) is included in the `.vsix`.
- **`tsconfig.json`** — unchanged module system; `@ts-ignore` used for the ESM
  dynamic import of `mupdf` to avoid moduleResolution friction.

### Kept (legacy)

- **`pdfjs` engine** — original heuristic pipeline (`pdf-extractor` →
  `text-normalizer` → `table-detector` → `markdown-transformer`) remains
  fully functional behind `pdfToMarkdown.engine: "pdfjs"`.

---

## [0.1.1] - (upstream)

Initial fork from [karthik-dasari/pdf-to-markdown](https://github.com/karthik-dasari/pdf-to-markdown).

- pdfjs-dist extraction with heuristic text normalization.
- Heading, bold/italic, bullet-list, and table detection.
- `preserveLayout`, `detectTables`, `mergeLines`, `outputFolder` settings.
