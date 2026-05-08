/**
 * Unit tests for the rich-block markdown transformer (MuPDF engine path).
 * Tests block interleaving, caption detection, and image extraction mode filtering.
 * Pure unit tests — no vscode imports.
 */

import { describe, it, expect } from 'vitest';
import { transformRichToMarkdown } from '../../src/services/markdown-transformer';
import {
  RichExtractedPage,
  TextBlock,
  ImageBlock,
  BBox,
  TextLine,
} from '../../src/models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextLine(
  text: string,
  fontSize = 12,
  bbox: BBox = [72, 100, 400, 115],
  overrides: Partial<TextLine> = {}
): TextLine {
  return {
    bbox,
    text,
    fontSize,
    isBold: false,
    isItalic: false,
    isMonospace: false,
    spans: [],
    ...overrides,
  };
}

function makeTextBlock(
  lines: TextLine[],
  bbox: BBox = [72, 100, 400, 300]
): TextBlock {
  return {
    type: 'text',
    bbox,
    lines,
    fontSize: lines[0]?.fontSize ?? 12,
    isBold: false,
    isItalic: false,
    isMonospace: false,
  };
}

function makeImageBlock(
  bbox: BBox,
  width = 200,
  height = 150
): ImageBlock {
  return {
    type: 'image',
    bbox,
    format: 'png',
    bytes: new Uint8Array(100),
    width,
    height,
  };
}

function makePage(blocks: (TextBlock | ImageBlock)[], pageNumber = 1): RichExtractedPage {
  return {
    pageNumber,
    width: 612,
    height: 792,
    blocks,
  };
}

const defaultOptions = {
  detectTables: false,
  preserveLayout: false,
  extractImages: 'inline' as const,
};

// ─── Block Interleaving Tests ─────────────────────────────────────────────────

describe('transformRichToMarkdown', () => {
  describe('block interleaving', () => {
    it('should emit text before image when text block has lower y0', () => {
      const textBlock = makeTextBlock(
        [makeTextLine('Introduction text', 12, [72, 50, 400, 65])],
        [72, 50, 400, 65]
      );
      const imgBlock = makeImageBlock([72, 100, 400, 300]);

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([textBlock, imgBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      const textIdx = result.indexOf('Introduction text');
      const imgIdx = result.indexOf('![');
      expect(textIdx).toBeGreaterThanOrEqual(0);
      expect(imgIdx).toBeGreaterThan(textIdx);
    });

    it('should emit image before text when image block has lower y0', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 200]);
      const textBlock = makeTextBlock(
        [makeTextLine('Body paragraph', 12, [72, 250, 400, 265])],
        [72, 250, 400, 265]
      );

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock, textBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      const imgIdx = result.indexOf('![');
      const textIdx = result.indexOf('Body paragraph');
      expect(imgIdx).toBeGreaterThanOrEqual(0);
      expect(textIdx).toBeGreaterThan(imgIdx);
    });

    it('should output image links with correct relative path', () => {
      const imgBlock = makeImageBlock([72, 50, 300, 200]);
      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'paper.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      expect(result).toContain('(paper.assets/page-1-img-0.png)');
    });

    it('should handle multiple images on the same page', () => {
      const img1 = makeImageBlock([72, 50, 300, 200]);
      const img2 = makeImageBlock([72, 300, 300, 450]);
      const imagePaths = new Map<ImageBlock, string>([
        [img1, 'doc.assets/page-1-img-0.png'],
        [img2, 'doc.assets/page-1-img-1.png'],
      ]);
      const page = makePage([img1, img2]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      expect(result).toContain('page-1-img-0.png');
      expect(result).toContain('page-1-img-1.png');
    });
  });

  // ─── Caption Detection Tests ────────────────────────────────────────────────

  describe('caption detection', () => {
    it('should use "Figure N" from next text block as alt text', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const captionBlock = makeTextBlock(
        [makeTextLine('Figure 3: Architecture overview', 10, [72, 260, 400, 272])],
        [72, 260, 400, 272]
      );

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock, captionBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      // Alt text should be the figure caption
      expect(result).toContain('![Figure 3: Architecture overview]');
      // Caption should be emitted as italic text
      expect(result).toContain('*Figure 3: Architecture overview*');
    });

    it('should use "Fig. N" caption pattern', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const captionBlock = makeTextBlock(
        [makeTextLine('Fig. 1 – System diagram', 10, [72, 260, 400, 272])],
        [72, 260, 400, 272]
      );

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock, captionBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      expect(result).toContain('![Fig. 1 – System diagram]');
    });

    it('should use "Table N" caption pattern', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const captionBlock = makeTextBlock(
        [makeTextLine('Table 2: Comparison results', 10, [72, 260, 400, 272])],
        [72, 260, 400, 272]
      );

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock, captionBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      expect(result).toContain('![Table 2: Comparison results]');
      expect(result).toContain('*Table 2: Comparison results*');
    });

    it('should fall back to "Figure" alt text when no caption follows', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const bodyBlock = makeTextBlock(
        [makeTextLine('Unrelated paragraph text', 12, [72, 260, 400, 272])],
        [72, 260, 400, 272]
      );

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock, bodyBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      // Falls back to "Figure" with no italic caption
      expect(result).toContain('![Figure]');
      expect(result).not.toContain('*Figure*');
    });

    it('should fall back to "Figure" when image is the last block', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);

      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);
      const result = transformRichToMarkdown([page], imagePaths, defaultOptions);

      expect(result).toContain('![Figure]');
    });
  });

  // ─── extractImages Mode Tests ────────────────────────────────────────────────

  describe('extractImages setting', () => {
    it('should emit image markdown when extractImages is "inline"', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);

      const result = transformRichToMarkdown([page], imagePaths, {
        ...defaultOptions,
        extractImages: 'inline',
      });

      expect(result).toContain('![Figure](doc.assets/page-1-img-0.png)');
    });

    it('should NOT emit image markdown when extractImages is "folder-only"', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);

      const result = transformRichToMarkdown([page], imagePaths, {
        ...defaultOptions,
        extractImages: 'folder-only',
      });

      expect(result).not.toContain('![');
    });

    it('should NOT emit image markdown when extractImages is "none"', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);

      const result = transformRichToMarkdown([page], imagePaths, {
        ...defaultOptions,
        extractImages: 'none',
      });

      expect(result).not.toContain('![');
    });

    it('should produce empty output for image-only page with extractImages "none"', () => {
      const imgBlock = makeImageBlock([72, 50, 400, 250]);
      const imagePaths = new Map<ImageBlock, string>([[imgBlock, 'doc.assets/page-1-img-0.png']]);
      const page = makePage([imgBlock]);

      const result = transformRichToMarkdown([page], imagePaths, {
        ...defaultOptions,
        extractImages: 'none',
      });

      expect(result.trim()).toBe('');
    });
  });

  // ─── Text Rendering Tests ────────────────────────────────────────────────────

  describe('text rendering', () => {
    it('should render heading for large font text', () => {
      const page = makePage([
        makeTextBlock(
          [
            makeTextLine('Main Title', 24, [72, 50, 400, 80]),
            makeTextLine('Body text paragraph', 12, [72, 100, 400, 115]),
          ],
          [72, 50, 400, 115]
        ),
      ]);

      const result = transformRichToMarkdown([page], new Map(), defaultOptions);

      expect(result).toContain('# Main Title');
      expect(result).toContain('Body text paragraph');
    });

    it('should render bold text', () => {
      const line = makeTextLine('Bold content', 12, [72, 50, 300, 65], { isBold: true });
      const page = makePage([makeTextBlock([line])]);

      const result = transformRichToMarkdown([page], new Map(), defaultOptions);

      expect(result).toContain('**Bold content**');
    });

    it('should render italic text', () => {
      const line = makeTextLine('Italic content', 12, [72, 50, 300, 65], { isItalic: true });
      const page = makePage([makeTextBlock([line])]);

      const result = transformRichToMarkdown([page], new Map(), defaultOptions);

      expect(result).toContain('_Italic content_');
    });

    it('should render code block for monospace lines', () => {
      const line = makeTextLine('const x = 1;', 10, [72, 50, 300, 65], { isMonospace: true });
      const page = makePage([makeTextBlock([line])]);

      const result = transformRichToMarkdown([page], new Map(), defaultOptions);

      expect(result).toContain('```');
      expect(result).toContain('const x = 1;');
    });

    it('should reconstruct a markdown table from MuPDF-style grid blocks', () => {
      const page = makePage([
        makeTextBlock([makeTextLine('Name', 12, [72, 100, 140, 115])], [72, 100, 140, 115]),
        makeTextBlock([makeTextLine('Age', 12, [220, 100, 270, 115])], [220, 100, 270, 115]),
        makeTextBlock([makeTextLine('City', 12, [330, 100, 410, 115])], [330, 100, 410, 115]),
        makeTextBlock([makeTextLine('Alice', 12, [72, 130, 150, 145])], [72, 130, 150, 145]),
        makeTextBlock([makeTextLine('30', 12, [220, 130, 245, 145])], [220, 130, 245, 145]),
        makeTextBlock([makeTextLine('New York', 12, [330, 130, 430, 145])], [330, 130, 430, 145]),
        makeTextBlock([makeTextLine('Bob', 12, [72, 160, 130, 175])], [72, 160, 130, 175]),
        makeTextBlock([makeTextLine('25', 12, [220, 160, 245, 175])], [220, 160, 245, 175]),
        makeTextBlock([makeTextLine('San Francisco', 12, [330, 160, 470, 175])], [330, 160, 470, 175]),
      ]);

      const result = transformRichToMarkdown([page], new Map(), {
        ...defaultOptions,
        detectTables: true,
      });

      expect(result).toContain('| Name | Age | City |');
      expect(result).toContain('| --- | --- | --- |');
      expect(result).toContain('| Alice | 30 | New York |');
      expect(result).toContain('| Bob | 25 | San Francisco |');
    });

    it('should return empty string for pages with no blocks', () => {
      const result = transformRichToMarkdown([], new Map(), defaultOptions);
      expect(result.trim()).toBe('');
    });
  });
});
