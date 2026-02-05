# 📄 PDF to Markdown Converter – VS Code Extension

**Business Requirements Document (BRD) + Functional Requirements Document (FRD)**

---

## 1. Document Overview

| Item             | Details                                                      |
| ---------------- | ------------------------------------------------------------ |
| Product Name     | PDF to Markdown Converter                                    |
| Platform         | VS Code Extension                                            |
| Document Type    | Combined BRD + FRD                                           |
| Target Users     | Developers, Technical Writers, Researchers, Product Managers |
| Primary Use Case | Convert PDFs into clean, editable Markdown inside VS Code    |

---

## 2. Business Requirements Document (BRD)

### 2.1 Problem Statement

PDFs are widely used for documentation, research papers, reports, and specifications. However:

* PDFs are **hard to edit**
* Copy-paste breaks formatting
* Code blocks, tables, and headings get corrupted
* Developers want content **directly usable in Markdown**

There is no seamless **in-editor VS Code solution** that converts PDFs to high-quality Markdown while preserving structure.

---

### 2.2 Business Goals

* Enable **one-click PDF → Markdown conversion** inside VS Code
* Reduce manual re-writing of documents
* Improve developer productivity
* Support documentation workflows (README, docs, specs)

---

### 2.3 Target Users

| User Type              | Needs                                        |
| ---------------------- | -------------------------------------------- |
| Developers             | Convert API docs, specs, research PDFs       |
| Technical Writers      | Convert PDFs into Markdown for documentation |
| Students / Researchers | Extract structured notes                     |
| Product Managers       | Convert PRDs, requirement PDFs               |

---

### 2.4 Key Value Proposition

* 📄 No external tools
* 🧠 Smart structure detection
* 🧾 Markdown-ready output
* ⚡ Fast and offline-friendly
* 🔐 Privacy-safe (local processing)

---

### 2.5 In-Scope

* PDF upload or selection
* Text extraction
* Markdown generation
* Preview & save output
* VS Code integration

### 2.6 Out-of-Scope (v1)

* OCR for scanned PDFs
* Cloud sync
* Multi-language translation
* Mobile support

---

### 2.7 Success Metrics

* Conversion success rate ≥ 90%
* Markdown structure accuracy
* User adoption & installs
* Positive VS Code Marketplace ratings

---

## 3. Functional Requirements Document (FRD)

---

## 3.1 System Overview

The VS Code extension allows users to:

1. Select a PDF file
2. Convert it to Markdown
3. Preview the result
4. Save as `.md` inside workspace

---

## 3.2 User Flow

```
User opens VS Code
   ↓
Right-click PDF OR Command Palette
   ↓
"Convert PDF to Markdown"
   ↓
Processing
   ↓
Preview Markdown
   ↓
Save / Edit
```

---

## 3.3 Functional Requirements

### 3.3.1 PDF Selection

| ID          | FR-01                                                 |
| ----------- | ----------------------------------------------------- |
| Feature     | Select PDF                                            |
| Description | User can select a PDF from file explorer or workspace |
| Acceptance  | PDF opens successfully                                |

---

### 3.3.2 Conversion Trigger

| ID          | FR-02                                      |
| ----------- | ------------------------------------------ |
| Feature     | Convert Action                             |
| Description | Convert via right-click or command palette |
| Commands    | `pdfToMarkdown.convert`                    |

---

### 3.3.3 Text Extraction

| ID             | FR-03                         |
| -------------- | ----------------------------- |
| Feature        | Extract Text                  |
| Description    | Extract text page by page     |
| Supports       | Multi-page PDFs               |
| Error Handling | Show error for encrypted PDFs |

---

### 3.3.4 Markdown Generation Rules

| PDF Element | Markdown Output  |
| ----------- | ---------------- |
| Headings    | `#`, `##`, `###` |
| Paragraphs  | Plain text       |
| Bold        | `**text**`       |
| Italic      | `_text_`         |
| Lists       | `- item`         |
| Tables      | Markdown tables  |
| Code Blocks | `code`           |
| Links       | `[text](url)`    |

---

### 3.3.5 Preview Panel

| ID          | FR-04                           |
| ----------- | ------------------------------- |
| Feature     | Markdown Preview                |
| Description | Show preview in VS Code WebView |
| Options     | Edit before saving              |

---

### 3.3.6 Save Output

| ID          | FR-05                        |
| ----------- | ---------------------------- |
| Feature     | Save Markdown                |
| Description | Save as `.md` file           |
| Location    | Same folder or user-selected |

---

### 3.3.7 Configuration Settings

| Setting                        | Description           |
| ------------------------------ | --------------------- |
| `pdfToMarkdown.preserveLayout` | Keep spacing & layout |
| `pdfToMarkdown.detectTables`   | Enable table parsing  |
| `pdfToMarkdown.mergeLines`     | Fix broken lines      |
| `pdfToMarkdown.outputFolder`   | Default save location |

---

### 3.3.8 Error Handling

| Scenario      | Behavior           |
| ------------- | ------------------ |
| Corrupt PDF   | Show error message |
| Encrypted PDF | Prompt user        |
| Large PDF     | Show progress bar  |

---

## 3.4 Non-Functional Requirements

### 3.4.1 Performance

* Conversion ≤ 5 sec for ≤ 20 pages
* Streamed processing for large PDFs

### 3.4.2 Security

* Local processing only
* No file uploads

### 3.4.3 Compatibility

* Windows / macOS / Linux
* VS Code latest + LTS

### 3.4.4 Usability

* Simple UX
* Keyboard shortcuts
* Clear progress feedback

---

## 3.5 Technical Architecture (High Level)

```
VS Code Extension (TypeScript)
   |
   |-- PDF Parser (pdfjs / pdf-lib)
   |-- Text Normalizer
   |-- Markdown Transformer
   |-- Preview WebView
```

---

## 3.6 Suggested Tech Stack

| Layer       | Technology         |
| ----------- | ------------------ |
| Extension   | VS Code API        |
| Language    | TypeScript         |
| PDF Parsing | pdfjs-dist         |
| UI          | WebView            |
| Markdown    | Custom transformer |

---

## 3.7 Future Enhancements (v2+)

* OCR support (Tesseract)
* AI-assisted cleanup
* Batch conversion
* Export to Notion / GitHub Wiki
* Scanned PDF support
* Theme-aware Markdown

---

## 4. Risks & Mitigations

| Risk                   | Mitigation             |
| ---------------------- | ---------------------- |
| Poor table detection   | Configurable parsing   |
| Large PDF memory usage | Streaming pages        |
| Layout loss            | Optional preserve mode |

---

## 5. Open Questions

* Should OCR be optional?
* Should images be embedded or referenced?
* Should math equations be supported (LaTeX)?

---

## 6. Conclusion

This VS Code extension provides a **fast, local, and developer-friendly** solution for converting PDFs into clean Markdown, reducing manual effort and improving documentation workflows.

---