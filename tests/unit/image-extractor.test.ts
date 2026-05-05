/**
 * Unit tests for the image extraction service.
 * Tests imageMinSize filtering, extractImages modes, and file writing.
 * Pure unit tests — no vscode imports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeImages } from '../../src/services/image-extractor';
import { ExtractedDocument, ImageBlock, RichExtractedPage } from '../../src/models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeImageBlock(width: number, height: number): ImageBlock {
  return {
    type: 'image',
    bbox: [72, 50, 72 + width, 50 + height],
    format: 'png',
    bytes: new Uint8Array(100).fill(1),
    width,
    height,
  };
}

function makeDocument(imageBlocks: ImageBlock[]): ExtractedDocument {
  const page: RichExtractedPage = {
    pageNumber: 1,
    width: 612,
    height: 792,
    blocks: imageBlocks,
  };
  return {
    pages: [page],
    metadata: { pageCount: 1 },
  };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-to-md-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('writeImages', () => {
  describe('extractImages: "none"', () => {
    it('should return empty map and write no files', () => {
      const img = makeImageBlock(200, 150);
      const doc = makeDocument([img]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'none',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(0);

      const assetsDir = path.join(tmpDir, 'test.assets');
      expect(fs.existsSync(assetsDir)).toBe(false);
    });
  });

  describe('extractImages: "inline" and "folder-only"', () => {
    it('should write PNG files and return relative paths for inline mode', () => {
      const img = makeImageBlock(200, 150);
      const doc = makeDocument([img]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(1);
      const relPath = result.get(img);
      expect(relPath).toBe('test.assets/page-1-img-0.png');

      const absPath = path.join(tmpDir, 'test.assets', 'page-1-img-0.png');
      expect(fs.existsSync(absPath)).toBe(true);
    });

    it('should write files for folder-only mode', () => {
      const img = makeImageBlock(200, 150);
      const doc = makeDocument([img]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'folder-only',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(1);

      const absPath = path.join(tmpDir, 'test.assets', 'page-1-img-0.png');
      expect(fs.existsSync(absPath)).toBe(true);
    });

    it('should use jpg extension when imageFormat is "jpg"', () => {
      const img = makeImageBlock(200, 150);
      const doc = makeDocument([img]);

      writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'jpg',
        imageMinSize: 32,
      });

      const absPath = path.join(tmpDir, 'test.assets', 'page-1-img-0.jpg');
      expect(fs.existsSync(absPath)).toBe(true);
    });
  });

  describe('imageMinSize filter', () => {
    it('should skip images whose min(width, height) < imageMinSize', () => {
      // 16×16 image, threshold = 32 → should be skipped
      const smallImg = makeImageBlock(16, 16);
      const doc = makeDocument([smallImg]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(0);
    });

    it('should skip images where width < imageMinSize even if height is large', () => {
      // 10×200 image, threshold = 32 → min(10, 200)=10 < 32 → skipped
      const thinImg = makeImageBlock(10, 200);
      const doc = makeDocument([thinImg]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(0);
    });

    it('should include images exactly at imageMinSize threshold', () => {
      // 32×32 image, threshold = 32 → min(32, 32)=32 >= 32 → included
      const img = makeImageBlock(32, 32);
      const doc = makeDocument([img]);

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(1);
    });

    it('should include large images and exclude small ones', () => {
      const smallImg = makeImageBlock(16, 16);
      const largeImg = makeImageBlock(200, 150);
      const page: RichExtractedPage = {
        pageNumber: 1,
        width: 612,
        height: 792,
        blocks: [smallImg, largeImg],
      };
      const doc: ExtractedDocument = { pages: [page], metadata: { pageCount: 1 } };

      const result = writeImages(doc, {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.size).toBe(1);
      expect(result.has(largeImg)).toBe(true);
      expect(result.has(smallImg)).toBe(false);
    });
  });

  describe('idempotency', () => {
    it('should overwrite existing assets folder contents on re-run', () => {
      const img = makeImageBlock(200, 150);
      const doc = makeDocument([img]);
      const context = {
        pdfStem: 'test',
        outputDir: tmpDir,
        extractImages: 'inline' as const,
        imageFormat: 'png' as const,
        imageMinSize: 32,
      };

      // Run twice
      writeImages(doc, context);
      writeImages(doc, context);

      const assetsDir = path.join(tmpDir, 'test.assets');
      const files = fs.readdirSync(assetsDir);
      // Should only have one file, not two
      expect(files.length).toBe(1);
    });
  });

  describe('multiple pages', () => {
    it('should use correct page numbers in filenames', () => {
      const img1 = makeImageBlock(200, 150);
      const img2 = makeImageBlock(300, 200);
      const doc: ExtractedDocument = {
        pages: [
          { pageNumber: 1, width: 612, height: 792, blocks: [img1] },
          { pageNumber: 2, width: 612, height: 792, blocks: [img2] },
        ],
        metadata: { pageCount: 2 },
      };

      const result = writeImages(doc, {
        pdfStem: 'doc',
        outputDir: tmpDir,
        extractImages: 'inline',
        imageFormat: 'png',
        imageMinSize: 32,
      });

      expect(result.get(img1)).toBe('doc.assets/page-1-img-0.png');
      expect(result.get(img2)).toBe('doc.assets/page-2-img-0.png');
    });
  });
});
