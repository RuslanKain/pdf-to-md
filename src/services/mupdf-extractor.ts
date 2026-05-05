/**
 * MuPDF WASM extraction service.
 * Uses the mupdf npm package (WASM build) as the primary extraction engine.
 * Produces a structured ExtractedDocument with text blocks and image blocks,
 * sorted by reading order (y0 then x0).
 * Pure TypeScript — no vscode imports.
 */

import {
  Block,
  BBox,
  TextBlock,
  TextLine,
  ImageBlock,
  RichExtractedPage,
  ExtractedDocument,
  PdfMetadata,
} from '../models/types';
import { parseFontName } from '../utils/font-utils';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/** Options for MuPDF extraction. */
export interface MupdfExtractorOptions {
  /** Absolute file path to the PDF (for error messages) */
  filePath: string;
  /** Output image format — affects how image bytes are encoded */
  imageFormat: 'png' | 'jpg';
  /** Minimum image dimension in pixels; smaller images are skipped */
  imageMinSize: number;
  /** Progress callback: (currentPage, totalPages) */
  onProgress?: (current: number, total: number) => void;
}

// Lazily loaded mupdf module (ESM, loaded via dynamic import)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mupdfModule: any = null;

/**
 * Lazily load the mupdf ESM module.
 * Dynamic import is required because mupdf uses top-level await.
 * The @ts-ignore suppresses the moduleResolution error for this ESM-only package.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMupdf(): Promise<any> {
  if (!mupdfModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – mupdf is ESM-only; external to the bundle, resolved at runtime
      mupdfModule = await import('mupdf');
    } catch (err) {
      throw new PdfExtractionError(ErrorCode.MUPDF_INIT_FAILED, err as Error);
    }
  }
  return mupdfModule;
}

/**
 * Convert a walker Rect ([x0, y0, x1, y1]) to our BBox tuple.
 */
function toBBox(rect: number[]): BBox {
  return [rect[0], rect[1], rect[2], rect[3]];
}

/**
 * Extract structured content from a PDF using MuPDF's structured text walker.
 * Produces TextBlocks and ImageBlocks sorted by reading order.
 *
 * @throws PdfExtractionError for corrupt, encrypted, empty, or inaccessible PDFs.
 */
export async function extractWithMupdf(
  pdfBytes: Uint8Array,
  options: MupdfExtractorOptions
): Promise<ExtractedDocument> {
  const { imageFormat, imageMinSize, onProgress } = options;

  const mupdf = await getMupdf();

  // Open the document
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = mupdf.Document.openDocument(pdfBytes.buffer, 'file.pdf');
  } catch (err) {
    const error = err as Error;
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('password') || msg.includes('PasswordException')) {
      throw new PdfExtractionError(ErrorCode.ENCRYPTED_PDF, error);
    }
    throw new PdfExtractionError(ErrorCode.CORRUPT_PDF, error);
  }

  // Check for password protection
  if (doc.needsPassword && doc.needsPassword()) {
    throw new PdfExtractionError(ErrorCode.ENCRYPTED_PDF);
  }

  const totalPages: number = doc.countPages();

  // Extract metadata
  const metadata: PdfMetadata = {
    pageCount: totalPages,
    title: doc.getMetaData('info:Title') || undefined,
    author: doc.getMetaData('info:Author') || undefined,
  };

  const pages: RichExtractedPage[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = doc.loadPage(pageIdx);
    const bounds: number[] = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    const pageHeight = bounds[3] - bounds[1];

    const blocks = extractPageBlocks(page, imageFormat, imageMinSize, mupdf);

    pages.push({
      pageNumber: pageIdx + 1,
      width: pageWidth,
      height: pageHeight,
      blocks,
    });

    onProgress?.(pageIdx + 1, totalPages);

    // Yield to event loop between pages
    if (pageIdx < totalPages - 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  return { pages, metadata };
}

/**
 * Extract all blocks (text + image) from a single page using the walker API.
 * Blocks are sorted by y0 (top-to-bottom), then x0 (left-to-right).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPageBlocks(page: any, imageFormat: 'png' | 'jpg', imageMinSize: number, mupdf: any): Block[] {
  const blocks: Block[] = [];

  // Collect text block state during walking
  let currentTextBBox: BBox | null = null;
  let currentLines: TextLine[] = [];
  let currentLineBBox: BBox | null = null;
  // Per-character accumulator for the current line
  interface CharEntry {
    text: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    font: any;
    size: number;
    origin: [number, number];
  }
  let currentLineChars: CharEntry[] = [];

  const stxt = page.toStructuredText('preserve-images');

  stxt.walk({
    // Image block: extract pixmap bytes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onImageBlock(bboxArr: number[], _transform: number[], image: any) {
      try {
        const rawPixmap = image.toPixmap();

        const imgWidth: number = rawPixmap.getWidth();
        const imgHeight: number = rawPixmap.getHeight();

        // Apply minimum-size filter
        if (Math.min(imgWidth, imgHeight) < imageMinSize) {
          rawPixmap.destroy?.();
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let finalPixmap: any = rawPixmap;
        let bytes: Uint8Array;

        if (imageFormat === 'jpg') {
          // Convert to RGB for JPEG (JPEG doesn't support alpha or CMYK directly)
          const cs = rawPixmap.getColorSpace?.();
          if (cs && !cs.isRGB?.()) {
            try {
              finalPixmap = rawPixmap.convertToColorSpace(mupdfModule.ColorSpace.DeviceRGB);
              rawPixmap.destroy?.();
            } catch {
              finalPixmap = rawPixmap;
            }
          }
          bytes = new Uint8Array(finalPixmap.asJPEG(85));
        } else {
          bytes = new Uint8Array(finalPixmap.asPNG());
        }

        if (finalPixmap !== rawPixmap) {
          finalPixmap.destroy?.();
        }

        blocks.push({
          type: 'image',
          bbox: toBBox(bboxArr),
          format: imageFormat === 'jpg' ? 'jpeg' : 'png',
          bytes,
          width: imgWidth,
          height: imgHeight,
        } satisfies ImageBlock);
      } catch {
        // Skip images that fail to render
      }
    },

    beginTextBlock(bboxArr: number[]) {
      currentTextBBox = toBBox(bboxArr);
      currentLines = [];
    },

    beginLine(bboxArr: number[]) {
      currentLineBBox = toBBox(bboxArr);
      currentLineChars = [];
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChar(c: string, origin: number[], font: any, size: number) {
      currentLineChars.push({ text: c, font, size, origin: [origin[0], origin[1]] });
    },

    endLine() {
      if (currentLineBBox && currentLineChars.length > 0) {
        const line = buildTextLine(currentLineBBox, currentLineChars);
        if (line.text.trim()) {
          currentLines.push(line);
        }
      }
      currentLineBBox = null;
      currentLineChars = [];
    },

    endTextBlock() {
      if (currentTextBBox && currentLines.length > 0) {
        blocks.push(buildTextBlock(currentTextBBox, currentLines));
      }
      currentTextBBox = null;
      currentLines = [];
    },
  });

  // Sort blocks: top-to-bottom (y0), then left-to-right (x0)
  blocks.sort((a, b) => {
    const dy = a.bbox[1] - b.bbox[1];
    if (Math.abs(dy) > 1) return dy;
    return a.bbox[0] - b.bbox[0];
  });

  return blocks;
}

/**
 * Build a TextLine from accumulated character entries.
 */
function buildTextLine(
  bbox: BBox,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chars: { text: string; font: any; size: number; origin: [number, number] }[]
): TextLine {
  // Combine characters into text
  const text = chars.map((c) => c.text).join('');

  // Determine dominant font properties (by character count)
  let boldCount = 0;
  let italicCount = 0;
  let monoCount = 0;
  let totalSize = 0;
  let totalChars = 0;

  for (const ch of chars) {
    const len = ch.text.length || 1;
    totalChars += len;
    totalSize += ch.size * len;

    // Use Font methods if available; fall back to parseFontName
    const fontName: string = ch.font?.getName?.() ?? '';
    const isBold: boolean = ch.font?.isBold?.() ?? parseFontName(fontName).isBold;
    const isItalic: boolean = ch.font?.isItalic?.() ?? parseFontName(fontName).isItalic;
    const isMono: boolean = ch.font?.isMono?.() ?? parseFontName(fontName).isMonospace;

    if (isBold) boldCount += len;
    if (isItalic) italicCount += len;
    if (isMono) monoCount += len;
  }

  const avgSize = totalChars > 0 ? totalSize / totalChars : 12;

  return {
    bbox,
    text,
    fontSize: Math.round(avgSize * 100) / 100,
    isBold: boldCount > totalChars / 2,
    isItalic: italicCount > totalChars / 2,
    isMonospace: monoCount > totalChars / 2,
    spans: [], // spans not needed for the current pipeline
  };
}

/**
 * Build a TextBlock from accumulated lines.
 */
function buildTextBlock(bbox: BBox, lines: TextLine[]): TextBlock {
  // Aggregate font properties from lines (weighted by text length)
  let boldCount = 0;
  let italicCount = 0;
  let monoCount = 0;
  let totalSize = 0;
  let totalChars = 0;

  for (const line of lines) {
    const len = line.text.length || 1;
    totalChars += len;
    totalSize += line.fontSize * len;
    if (line.isBold) boldCount += len;
    if (line.isItalic) italicCount += len;
    if (line.isMonospace) monoCount += len;
  }

  const avgSize = totalChars > 0 ? totalSize / totalChars : 12;

  return {
    type: 'text',
    bbox,
    lines,
    fontSize: Math.round(avgSize * 100) / 100,
    isBold: boldCount > totalChars / 2,
    isItalic: italicCount > totalChars / 2,
    isMonospace: monoCount > totalChars / 2,
  };
}
