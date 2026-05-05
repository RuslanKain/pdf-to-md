/**
 * Shared TypeScript interfaces for the PDF to Markdown converter.
 * All types defined here are used across services, models, and commands.
 * This file has ZERO vscode imports — only pure TypeScript types.
 */

// ─── Rich Block Model (MuPDF engine) ──────────────────────────────────────────

/**
 * Bounding box as [x0, y0, x1, y1] tuple in PDF device coordinates
 * (y increases downward, origin at top-left).
 */
export type BBox = [number, number, number, number];

/** A text span within a TextLine: a run of characters sharing the same font. */
export interface TextSpan {
  /** The span's text content */
  text: string;
  /** Bounding box [x0, y0, x1, y1] */
  bbox: BBox;
  /** Font size in points */
  fontSize: number;
  /** Font name */
  fontName: string;
  /** Whether the font is bold */
  isBold: boolean;
  /** Whether the font is italic */
  isItalic: boolean;
  /** Whether the font is monospace */
  isMonospace: boolean;
}

/** A single text line within a TextBlock. */
export interface TextLine {
  /** Bounding box [x0, y0, x1, y1] */
  bbox: BBox;
  /** Combined text of all spans on this line */
  text: string;
  /** Dominant font size in points */
  fontSize: number;
  /** Whether the dominant font is bold */
  isBold: boolean;
  /** Whether the dominant font is italic */
  isItalic: boolean;
  /** Whether the dominant font is monospace */
  isMonospace: boolean;
  /** Individual character spans (may be empty if not needed) */
  spans: TextSpan[];
}

/** A block of text lines extracted from the PDF. */
export interface TextBlock {
  type: 'text';
  /** Bounding box [x0, y0, x1, y1] */
  bbox: BBox;
  /** Ordered lines within this block */
  lines: TextLine[];
  /** Dominant font size across all lines */
  fontSize: number;
  /** Whether the majority of text is bold */
  isBold: boolean;
  /** Whether the majority of text is italic */
  isItalic: boolean;
  /** Whether the majority of text is monospace */
  isMonospace: boolean;
}

/** An image block extracted from the PDF. */
export interface ImageBlock {
  type: 'image';
  /** Bounding box [x0, y0, x1, y1] in PDF device coordinates */
  bbox: BBox;
  /** Image encoding format */
  format: 'png' | 'jpeg';
  /** Raw image bytes (PNG or JPEG) */
  bytes: Uint8Array;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/** A block is either a text block or an image block. */
export type Block = TextBlock | ImageBlock;

/** A single page from the MuPDF structured extraction. */
export interface RichExtractedPage {
  /** 1-based page index */
  pageNumber: number;
  /** Page width in PDF units */
  width: number;
  /** Page height in PDF units */
  height: number;
  /** Ordered blocks (text + image), sorted by y0 then x0 */
  blocks: Block[];
}

/** Result of extracting a document via the MuPDF engine. */
export interface ExtractedDocument {
  pages: RichExtractedPage[];
  metadata: PdfMetadata;
}

// ─── PDF Extraction Types ──────────────────────────────────────────────────────

/** A single text span extracted from a PDF page, with positional metadata. */
export interface ExtractedTextItem {
  /** The text content */
  str: string;
  /** Horizontal position (from transform[4]) in PDF coordinate units */
  x: number;
  /** Vertical position (from transform[5]) in PDF coordinate units */
  y: number;
  /** Width of the text span (≥ 0) */
  width: number;
  /** Height of the text span, approximated from font size (≥ 0) */
  height: number;
  /** Font identifier, used for bold/italic/heading detection */
  fontName: string;
  /** Font family from pdfjs-dist styles (e.g., "sans-serif", "monospace") */
  fontFamily?: string;
  /** Font size in points, derived from transform matrix */
  fontSize: number;
  /** Whether this item ends a line (from pdfjs-dist) */
  hasEOL: boolean;
}

/** A single page extracted from the PDF. */
export interface ExtractedPage {
  /** 1-based page index */
  pageNumber: number;
  /** Page width in PDF units */
  width: number;
  /** Page height in PDF units */
  height: number;
  /** Array of text spans with position data */
  textItems: ExtractedTextItem[];
}

/** Result of extracting all pages from a PDF. */
export interface PdfExtractionResult {
  pages: ExtractedPage[];
  metadata: PdfMetadata;
}

/** PDF document metadata extracted during loading. */
export interface PdfMetadata {
  title?: string;
  author?: string;
  pageCount: number;
}

// ─── Font Types ────────────────────────────────────────────────────────────────

/** Metadata about a font used in the PDF, for detecting semantic formatting. */
export interface FontMetadata {
  /** Font name (e.g., "TimesNewRoman-Bold") */
  name: string;
  /** Whether the font is bold (detected from name or weight) */
  isBold: boolean;
  /** Whether the font is italic (detected from name or style) */
  isItalic: boolean;
  /** Whether the font is monospace (detected from name heuristics) */
  isMonospace: boolean;
}

// ─── Text Normalization Types ──────────────────────────────────────────────────

/** A line of text grouped from raw text items, with detected font properties. */
export interface NormalizedLine {
  /** The combined text content of this line */
  text: string;
  /** Horizontal position of the line start */
  x: number;
  /** Vertical position of the line */
  y: number;
  /** Dominant font size in points */
  fontSize: number;
  /** Whether the dominant font is bold */
  isBold: boolean;
  /** Whether the dominant font is italic */
  isItalic: boolean;
  /** Whether the dominant font is monospace */
  isMonospace: boolean;
  /** The original extracted text items that compose this line */
  items: ExtractedTextItem[];
}

/** A normalized page with grouped lines. */
export interface NormalizedPage {
  pageNumber: number;
  lines: NormalizedLine[];
}

/** Options controlling text normalization behavior. */
export interface NormalizerOptions {
  /** Merge broken lines into coherent paragraphs */
  mergeLines: boolean;
  /** Retain original spacing and line breaks */
  preserveLayout: boolean;
}

// ─── Table Detection Types ─────────────────────────────────────────────────────

/** A single cell in a detected table. */
export interface TableCell {
  row: number;
  col: number;
  text: string;
}

/** A detected table region with headers and data rows. */
export interface DetectedTable {
  /** 0-based index of the first line in this table region */
  startLineIndex: number;
  /** 0-based index of the last line in this table region */
  endLineIndex: number;
  /** Column headers (first row) */
  headers: string[];
  /** Data rows (excluding header) */
  rows: string[][];
}

// ─── Markdown Transformation Types ─────────────────────────────────────────────

/** Options controlling Markdown transformation behavior. */
export interface TransformerOptions {
  /** Whether to detect and render tables */
  detectTables: boolean;
  /** Whether to preserve original layout */
  preserveLayout: boolean;
}

// ─── Conversion Pipeline Types ─────────────────────────────────────────────────

/** Options for the full conversion pipeline. */
export interface ConversionOptions {
  /** Absolute file path to the PDF */
  filePath: string;
  /** Retain original spacing and line breaks */
  preserveLayout: boolean;
  /** Enable heuristic table detection */
  detectTables: boolean;
  /** Merge broken lines into coherent paragraphs */
  mergeLines: boolean;
  /** Extraction engine to use */
  engine: 'mupdf' | 'pdfjs' | 'pythonSidecar';
  /** Image extraction mode */
  extractImages: 'inline' | 'folder-only' | 'none';
  /** Output image format */
  imageFormat: 'png' | 'jpg';
  /** Minimum image dimension in pixels to extract */
  imageMinSize: number;
  /** Path to Python interpreter (pythonSidecar engine) */
  pythonPath: string;
  /** Resolved output directory for writing .md and assets */
  outputDir: string;
  /** Progress callback: (currentPage, totalPages) */
  onProgress?: (current: number, total: number) => void;
}

/** Result of a successful conversion. */
export interface ConversionResult {
  /** The generated Markdown string */
  markdown: string;
  /** Total number of pages in the source PDF */
  pageCount: number;
  /** Extracted PDF metadata */
  metadata: {
    title?: string;
    author?: string;
  };
}

// ─── Configuration Types ───────────────────────────────────────────────────────

/** User preferences controlling conversion behavior, from VS Code settings. */
export interface ConversionConfiguration {
  /** Retain original spacing and line breaks */
  preserveLayout: boolean;
  /** Enable heuristic table detection */
  detectTables: boolean;
  /** Merge broken lines into coherent paragraphs */
  mergeLines: boolean;
  /** Default save location for output files (empty = same as source) */
  outputFolder: string;
  /** Extraction engine */
  engine: 'mupdf' | 'pdfjs' | 'pythonSidecar';
  /** Image extraction mode */
  extractImages: 'inline' | 'folder-only' | 'none';
  /** Output image format */
  imageFormat: 'png' | 'jpg';
  /** Minimum image dimension in pixels */
  imageMinSize: number;
  /** Path to Python interpreter */
  pythonPath: string;
}

// ─── Conversion Job Types ──────────────────────────────────────────────────────

/** Status of a conversion job. */
export enum ConversionStatus {
  Pending = 'Pending',
  Extracting = 'Extracting',
  Transforming = 'Transforming',
  Complete = 'Complete',
  Failed = 'Failed',
}
