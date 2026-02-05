/**
 * PDF text extraction service using pdfjs-dist.
 * Loads a PDF file and extracts text items with position data from each page.
 * Pure TypeScript — no vscode imports.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ExtractedPage,
  ExtractedTextItem,
  PdfExtractionResult,
} from '../models/types';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/** Options for PDF extraction. */
export interface PdfExtractorOptions {
  /** Absolute file path to the PDF */
  filePath: string;
  /** Callback invoked after each page is extracted; receives (currentPage, totalPages) */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Yield to the event loop between pages to keep the editor responsive.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Extract text content from all pages of a PDF.
 * Processes pages in sequence, yielding to the event loop between pages.
 *
 * @throws PdfExtractionError for corrupt, encrypted, or inaccessible PDFs.
 */
export async function extractPdf(
  options: PdfExtractorOptions
): Promise<PdfExtractionResult> {
  const { filePath, onProgress } = options;

  // Check file exists
  let fileData: Uint8Array;
  try {
    const buffer = fs.readFileSync(filePath);
    fileData = new Uint8Array(buffer);
  } catch (err) {
    throw new PdfExtractionError(ErrorCode.IO_ERROR, err as Error);
  }

  // Import pdfjs-dist (kept external from bundle, resolved from node_modules at runtime)
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

  // Point worker to the actual worker file shipped with pdfjs-dist
  const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.join(path.dirname(pdfjsPath), 'pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

  let pdfDocument: { numPages: number; getPage: (n: number) => Promise<unknown>; getMetadata: () => Promise<{ info: Record<string, string> }> };

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: fileData,
      useSystemFonts: true,
      isEvalSupported: false,
    });
    pdfDocument = await loadingTask.promise;
  } catch (err: unknown) {
    const error = err as Error & { name?: string };
    if (error.name === 'PasswordException' || String(error.message).includes('password')) {
      throw new PdfExtractionError(ErrorCode.ENCRYPTED_PDF, error);
    }
    if (
      error.name === 'InvalidPDFException' ||
      String(error.message).includes('Invalid PDF')
    ) {
      throw new PdfExtractionError(ErrorCode.CORRUPT_PDF, error);
    }
    throw new PdfExtractionError(ErrorCode.CORRUPT_PDF, error);
  }

  const totalPages = pdfDocument.numPages;

  // Extract metadata
  let title: string | undefined;
  let author: string | undefined;
  try {
    const meta = await pdfDocument.getMetadata();
    if (meta?.info) {
      title = meta.info['Title'] || undefined;
      author = meta.info['Author'] || undefined;
    }
  } catch {
    // Metadata extraction is optional — continue without it
  }

  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = (await pdfDocument.getPage(pageNum)) as {
      getViewport: (opts: { scale: number }) => { width: number; height: number };
      getTextContent: () => Promise<{
        items: Array<{
          str: string;
          transform: number[];
          width: number;
          height: number;
          fontName: string;
          hasEOL: boolean;
        }>;
        styles: Record<string, { fontFamily?: string; ascent?: number; descent?: number }>;
      }>;
    };

    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const fontStyles = textContent.styles || {};

    const textItems: ExtractedTextItem[] = textContent.items
      .filter((item) => typeof item.str === 'string')
      .map((item) => {
        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        // Font size is derived from the scale components of the transform matrix
        const fontSize = Math.sqrt(
          transform[0] * transform[0] + transform[1] * transform[1]
        );

        // Get fontFamily from pdfjs-dist styles dict (e.g., "sans-serif", "monospace")
        const style = fontStyles[item.fontName];
        const fontFamily = style?.fontFamily || undefined;

        return {
          str: item.str,
          x: transform[4],
          y: transform[5],
          width: item.width,
          height: item.height || fontSize,
          fontName: item.fontName || '',
          fontFamily,
          fontSize,
          hasEOL: item.hasEOL || false,
        };
      });

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      textItems,
    });

    onProgress?.(pageNum, totalPages);

    // Yield to event loop between pages for large documents
    if (pageNum < totalPages) {
      await yieldToEventLoop();
    }
  }

  // Check for empty content
  const totalTextItems = pages.reduce((sum, p) => sum + p.textItems.length, 0);
  if (totalTextItems === 0) {
    throw new PdfExtractionError(ErrorCode.EMPTY_CONTENT);
  }

  return {
    pages,
    metadata: {
      title,
      author,
      pageCount: totalPages,
    },
  };
}
