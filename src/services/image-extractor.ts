/**
 * Image extraction service.
 * Writes ImageBlock bytes to disk and returns a map of block → relative path.
 * Pure TypeScript — no vscode imports.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExtractedDocument, ImageBlock } from '../models/types';
import { PdfExtractionError, ErrorCode } from '../models/errors';

/** Options controlling image extraction behavior. */
export interface ImageExtractionContext {
  /** Base name of the PDF (without extension) — used to name the assets folder */
  pdfStem: string;
  /** Resolved absolute directory where the .md file will be written */
  outputDir: string;
  /** Image extraction mode */
  extractImages: 'inline' | 'folder-only' | 'none';
  /** Output image format */
  imageFormat: 'png' | 'jpg';
  /** Minimum image dimension in pixels to extract */
  imageMinSize: number;
}

/**
 * Write image files from an ExtractedDocument to disk.
 *
 * For each ImageBlock whose dimensions meet the `imageMinSize` threshold,
 * writes the bytes to `<outputDir>/<pdfStem>.assets/page-<n>-img-<k>.<ext>`.
 *
 * @returns A Map from ImageBlock object reference to the relative POSIX path
 *          that should appear in the Markdown image link.
 *          Returns an empty Map when `extractImages === "none"`.
 * @throws PdfExtractionError(IMAGE_WRITE_FAILED) if any write fails.
 */
export function writeImages(
  doc: ExtractedDocument,
  context: ImageExtractionContext
): Map<ImageBlock, string> {
  const { pdfStem, outputDir, extractImages, imageFormat, imageMinSize } = context;

  const result = new Map<ImageBlock, string>();

  if (extractImages === 'none') {
    return result;
  }

  // Determine the assets folder path
  const assetsFolderName = `${pdfStem}.assets`;
  const assetsFolderPath = path.join(outputDir, assetsFolderName);

  // Collect all image blocks across all pages (for deduplication / overwrite logic)
  const allImages: { block: ImageBlock; pageNumber: number; indexOnPage: number }[] = [];
  for (const page of doc.pages) {
    let imgIdx = 0;
    for (const block of page.blocks) {
      if (block.type === 'image') {
        // Apply minimum-size filter (already applied in extractor, but guard here too)
        if (Math.min(block.width, block.height) >= imageMinSize) {
          allImages.push({ block, pageNumber: page.pageNumber, indexOnPage: imgIdx });
          imgIdx++;
        }
      }
    }
  }

  if (allImages.length === 0) {
    return result;
  }

  // Create (or clear) the assets folder for idempotency
  try {
    if (fs.existsSync(assetsFolderPath)) {
      // Remove existing images from this folder so stale files don't accumulate
      const existing = fs.readdirSync(assetsFolderPath);
      for (const f of existing) {
        fs.unlinkSync(path.join(assetsFolderPath, f));
      }
    } else {
      fs.mkdirSync(assetsFolderPath, { recursive: true });
    }
  } catch (err) {
    throw new PdfExtractionError(ErrorCode.IMAGE_WRITE_FAILED, err as Error);
  }

  // Write each image
  const ext = imageFormat === 'jpg' ? 'jpg' : 'png';

  for (const { block, pageNumber, indexOnPage } of allImages) {
    const filename = `page-${pageNumber}-img-${indexOnPage}.${ext}`;
    const absPath = path.join(assetsFolderPath, filename);

    try {
      fs.writeFileSync(absPath, block.bytes);
    } catch (err) {
      throw new PdfExtractionError(ErrorCode.IMAGE_WRITE_FAILED, err as Error);
    }

    // Return a relative POSIX path (forward slashes for Markdown links)
    const relativePath = [assetsFolderName, filename].join('/');
    result.set(block, relativePath);
  }

  return result;
}
