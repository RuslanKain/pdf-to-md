/**
 * Conversion pipeline orchestrator.
 * Selects the extraction engine and runs the full PDF-to-Markdown conversion:
 *   MuPDF engine:   extract → image write → transform rich blocks
 *   pdfjs engine:   extract → normalize → (detect tables) → transform
 *   Python sidecar: shell out to convert_pdfs_to_md.py → return its output
 * Pure TypeScript — no vscode imports.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ConversionOptions,
  ConversionResult,
} from '../models/types';
import { extractPdf } from './pdf-extractor';
import { normalizePages } from './text-normalizer';
import { detectTables as runTableDetection } from './table-detector';
import { transformToMarkdown, transformRichToMarkdown } from './markdown-transformer';
import { extractWithMupdf } from './mupdf-extractor';
import { writeImages } from './image-extractor';
import { convertWithPython } from './python-sidecar';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/**
 * Run the full PDF-to-Markdown conversion pipeline.
 * The engine is selected via `options.engine`.
 *
 * @param options - Conversion options including file path, settings, and progress callback.
 * @returns ConversionResult with the generated Markdown string and metadata.
 * @throws PdfExtractionError for PDF-level errors (corrupt, encrypted, empty, I/O, etc.).
 */
export async function convertPdfToMarkdown(
  options: ConversionOptions
): Promise<ConversionResult> {
  const {
    filePath,
    engine,
    preserveLayout,
    detectTables,
    mergeLines,
    extractImages,
    imageFormat,
    imageMinSize,
    pythonPath,
    outputDir,
    onProgress,
  } = options;

  // ─── Python sidecar engine ──────────────────────────────────────────────────
  if (engine === 'pythonSidecar') {
    // Resolve script path: <extensionRoot>/scripts/convert_pdfs_to_md.py
    // __dirname here is the bundle directory (dist/), so go one level up
    const scriptPath = path.join(__dirname, '..', 'scripts', 'convert_pdfs_to_md.py');

    const markdown = await convertWithPython(filePath, pythonPath, scriptPath);

    return {
      markdown,
      pageCount: 0, // not available from sidecar output
      metadata: {},
    };
  }

  // ─── pdfjs legacy engine ────────────────────────────────────────────────────
  if (engine === 'pdfjs') {
    const extractionResult = await extractPdf({ filePath, onProgress });

    const normalizedPages = normalizePages(extractionResult.pages, {
      mergeLines,
      preserveLayout,
    });

    const detectedTables = detectTables
      ? runTableDetection(normalizedPages)
      : undefined;

    const markdown = transformToMarkdown(
      normalizedPages,
      { detectTables, preserveLayout },
      detectedTables
    );

    return {
      markdown,
      pageCount: extractionResult.metadata.pageCount,
      metadata: {
        title: extractionResult.metadata.title,
        author: extractionResult.metadata.author,
      },
    };
  }

  // ─── MuPDF engine (default) ─────────────────────────────────────────────────
  // Read PDF bytes from disk
  let pdfBytes: Uint8Array;
  try {
    const buffer = fs.readFileSync(filePath);
    pdfBytes = new Uint8Array(buffer);
  } catch (err) {
    throw new PdfExtractionError(ErrorCode.IO_ERROR, err as Error);
  }

  const extractedDoc = await extractWithMupdf(pdfBytes, {
    filePath,
    imageFormat,
    imageMinSize,
    onProgress,
  });

  // Write images and get relative paths
  const pdfStem = path.basename(filePath, '.pdf');
  const imagePaths = writeImages(extractedDoc, {
    pdfStem,
    outputDir,
    extractImages,
    imageFormat,
    imageMinSize,
  });

  // Transform blocks to Markdown
  const markdown = transformRichToMarkdown(extractedDoc.pages, imagePaths, {
    detectTables,
    preserveLayout,
    extractImages,
  });

  return {
    markdown,
    pageCount: extractedDoc.metadata.pageCount,
    metadata: {
      title: extractedDoc.metadata.title,
      author: extractedDoc.metadata.author,
    },
  };
}

