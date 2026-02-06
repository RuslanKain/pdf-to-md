# PDF to Markdown — VS Code Extension

Convert PDF files into clean, structured Markdown inside VS Code. The extension extracts text, detects document structure (headings, paragraphs, lists, tables, code blocks), and produces a `.md` file — all processed locally with zero cloud dependencies.

![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **One-click conversion**: Right-click any `.pdf` file in the Explorer → "Convert PDF to Markdown"
- **Command Palette**: `Ctrl+Shift+P` → "PDF to Markdown: Convert PDF to Markdown"
- **Structure preservation**: Headings, bold, italic, lists (bullet + ordered), links, code blocks
- **Table detection**: Heuristic column-boundary analysis renders tables as pipe-delimited Markdown
- **Side-by-side preview**: Automatically opens the VS Code Markdown preview next to the raw file
- **Configurable**: Adjust layout preservation, table detection, line merging, and output folder
- **Graceful error handling**: Clear notifications for corrupt, encrypted, empty, and inaccessible PDFs
- **Progress indicator**: Per-page progress notification for large documents
- **100% local**: No data leaves your machine — all processing happens in the extension host

## Installation

### From Marketplace (when published)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "PDF to Markdown"
4. Click **Install**

### From Source

```bash
git clone https://github.com/karthik-dasari/pdf-to-markdown.git
cd pdf-to-markdown
npm install
npm run build
```

Then press `F5` to launch the Extension Development Host.

## Usage

### Context Menu

1. Right-click a `.pdf` file in the Explorer sidebar
2. Select **"Convert PDF to Markdown"**
3. The `.md` file is saved next to the original and opened with a live preview

### Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type **"PDF to Markdown: Convert PDF to Markdown"**
3. Select a PDF file from the file picker
4. Conversion runs with a progress indicator

## Configuration

All settings are under `pdfToMarkdown.*` in VS Code Settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pdfToMarkdown.preserveLayout` | boolean | `false` | Retain original spacing and line breaks from the PDF |
| `pdfToMarkdown.detectTables` | boolean | `true` | Enable heuristic table detection and Markdown table output |
| `pdfToMarkdown.mergeLines` | boolean | `true` | Merge broken lines into coherent paragraphs |
| `pdfToMarkdown.outputFolder` | string | `""` | Custom output folder (absolute or workspace-relative). Empty = same directory as source PDF |

### Example settings.json

```json
{
  "pdfToMarkdown.preserveLayout": false,
  "pdfToMarkdown.detectTables": true,
  "pdfToMarkdown.mergeLines": true,
  "pdfToMarkdown.outputFolder": "converted"
}
```

## Supported PDF Types

| PDF Type | Support |
|----------|---------|
| Text-based PDFs | ✅ Full support |
| Mixed text + images | ✅ Text extracted, images ignored |
| Multi-page documents | ✅ All pages processed |
| PDFs with tables | ✅ Heuristic detection |
| Scanned/image-only PDFs | ⚠️ Warning shown (no OCR) |
| Password-protected PDFs | ❌ Warning shown |
| Corrupt/invalid files | ❌ Error shown |

## Architecture

```
src/
├── extension.ts              # Entry point (activate/deactivate)
├── commands/
│   └── convert-command.ts    # VS Code command handler (only file with vscode imports)
├── services/
│   ├── pdf-extractor.ts      # pdfjs-dist text extraction
│   ├── text-normalizer.ts    # Line grouping, font detection, paragraph merging
│   ├── table-detector.ts     # Heuristic table structure detection
│   ├── markdown-transformer.ts  # Heading/list/code/table → Markdown
│   └── conversion-pipeline.ts   # Orchestrator: extract → normalize → detect → transform
├── models/
│   ├── types.ts              # All shared TypeScript interfaces
│   └── errors.ts             # PdfExtractionError with ErrorCode enum
└── utils/
    └── font-utils.ts         # Font name parsing (bold/italic/monospace)
```

**Design principle**: Only `src/commands/` and `src/extension.ts` import `vscode`. All services are pure TypeScript — testable in isolation.

## Development

### Prerequisites

- Node.js 18+
- VS Code ^1.85.0

### Setup

```bash
npm install
```

### Build

```bash
npm run build            # Production bundle
npm run watch            # Watch mode with auto-rebuild
npm run compile          # TypeScript type-checking only
```

### Test

```bash
npm run test:unit        # Vitest unit tests (fast, no VS Code needed)
npm run test:unit:watch  # Vitest watch mode
npm run test:integration # Integration tests in Extension Development Host
npm run test             # Both unit + integration
```

### Lint

```bash
npm run lint
```

### Package

```bash
npm run package          # Creates .vsix file
```

### Debug

1. Open this project in VS Code
2. Press `F5` → "Run Extension" to launch the Extension Development Host
3. Set breakpoints in `src/` files
4. Use the "Extension Tests" launch configuration for debugging tests

## Known Limitations

- **No OCR**: Image-only (scanned) PDFs will produce empty output with a warning
- **No password support**: Encrypted PDFs are not supported in this version
- **Table detection is heuristic**: Complex tables with merged cells, nested tables, or irregular layouts may not be detected correctly
- **No image extraction**: Images in PDFs are ignored; only text content is converted
- **Font-based heading detection**: Headings are detected by font size + bold heuristics — documents with non-standard font hierarchies may produce incorrect heading levels
- **Single-file conversion**: Batch conversion is not yet supported

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD approach)
4. Implement the feature
5. Ensure all tests pass (`npm test`)
6. Submit a pull request

## License

MIT
