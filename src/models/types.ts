/**
 * Shared TypeScript interfaces for the PDF to Markdown converter.
 * All types defined here are used across services, models, and commands.
 * This file has ZERO vscode imports — only pure TypeScript types.
 */

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
