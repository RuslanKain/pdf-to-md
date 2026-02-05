/**
 * Conversion pipeline orchestrator.
 * Runs the full PDF-to-Markdown conversion flow:
 * extract → normalize → (detect tables) → transform.
 * Pure TypeScript — no vscode imports.
 */

import {
  ConversionOptions,
  ConversionResult,
} from '../models/types';
import { extractPdf } from './pdf-extractor';
import { normalizePages } from './text-normalizer';
import { detectTables as runTableDetection } from './table-detector';
import { transformToMarkdown } from './markdown-transformer';

/**
 * Run the full PDF-to-Markdown conversion pipeline.
 *
 * @param options - Conversion options including file path, settings, and progress callback.
 * @returns ConversionResult with the generated Markdown string and metadata.
 * @throws PdfExtractionError for PDF-level errors (corrupt, encrypted, empty, I/O).
 */
export async function convertPdfToMarkdown(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { filePath, preserveLayout, detectTables, mergeLines, onProgress } = options;

  // Step 1: Extract text from PDF
  const extractionResult = await extractPdf({
    filePath,
    onProgress,
  });

  // Step 2: Normalize pages (group into lines, detect fonts, merge)
  const normalizedPages = normalizePages(extractionResult.pages, {
    mergeLines,
    preserveLayout,
  });

  // Step 3: Detect tables (if enabled)
  const detectedTables = detectTables
    ? runTableDetection(normalizedPages)
    : undefined;

  // Step 4: Transform to Markdown
  const markdown = transformToMarkdown(normalizedPages, {
    detectTables,
    preserveLayout,
  }, detectedTables);

  return {
    markdown,
    pageCount: extractionResult.metadata.pageCount,
    metadata: {
      title: extractionResult.metadata.title,
      author: extractionResult.metadata.author,
    },
  };
}
