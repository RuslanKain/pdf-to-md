import { describe, it, expect } from 'vitest';
import { normalizePages } from '../../src/services/text-normalizer';
import { ExtractedPage, ExtractedTextItem, NormalizerOptions } from '../../src/models/types';

/** Helper to create an ExtractedTextItem with defaults. */
function makeTextItem(overrides: Partial<ExtractedTextItem>): ExtractedTextItem {
  return {
    str: '',
    x: 0,
    y: 0,
    width: 50,
    height: 12,
    fontName: 'Helvetica',
    fontSize: 12,
    hasEOL: false,
    ...overrides,
  };
}

/** Helper to create an ExtractedPage. */
function makePage(pageNumber: number, textItems: ExtractedTextItem[]): ExtractedPage {
  return { pageNumber, width: 612, height: 792, textItems };
}

const defaultOptions: NormalizerOptions = {
  mergeLines: true,
  preserveLayout: false,
};

describe('normalizePages', () => {
  describe('line grouping by Y-coordinate', () => {
    it('should group text items with the same Y into a single line', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Hello ', x: 50, y: 700 }),
        makeTextItem({ str: 'World', x: 100, y: 700 }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result).toHaveLength(1);
      expect(result[0].lines).toHaveLength(1);
      expect(result[0].lines[0].text).toBe('Hello World');
    });

    it('should group text items with similar Y (within tolerance) into same line', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Hello ', x: 50, y: 700, fontSize: 12 }),
        makeTextItem({ str: 'World', x: 100, y: 701, fontSize: 12 }), // 1pt off
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines).toHaveLength(1);
      expect(result[0].lines[0].text).toBe('Hello World');
    });

    it('should separate text items with different Y into different lines', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Line 1', x: 50, y: 700 }),
        makeTextItem({ str: 'Line 2', x: 50, y: 680 }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines).toHaveLength(2);
    });

    it('should order lines from top to bottom (descending Y in PDF coords)', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Bottom', x: 50, y: 100 }),
        makeTextItem({ str: 'Top', x: 50, y: 700 }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines[0].text).toBe('Top');
      expect(result[0].lines[1].text).toBe('Bottom');
    });

    it('should sort items within a line by X coordinate (left to right)', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'World', x: 150, y: 700 }),
        makeTextItem({ str: 'Hello ', x: 50, y: 700 }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines[0].text).toBe('Hello World');
    });
  });

  describe('font property detection', () => {
    it('should detect bold font', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Bold text', x: 50, y: 700, fontName: 'Helvetica-Bold' }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines[0].isBold).toBe(true);
      expect(result[0].lines[0].isItalic).toBe(false);
    });

    it('should detect italic font', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Italic text', x: 50, y: 700, fontName: 'Helvetica-Italic' }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines[0].isItalic).toBe(true);
    });

    it('should detect monospace font', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'code()', x: 50, y: 700, fontName: 'Courier' }),
      ]);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines[0].isMonospace).toBe(true);
    });
  });

  describe('line merging', () => {
    it('should merge broken lines into paragraphs when mergeLines is true', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'This is a sentence that', x: 50, y: 700, fontSize: 12 }),
        makeTextItem({ str: 'continues on the next line.', x: 50, y: 686, fontSize: 12 }),
      ]);

      const result = normalizePages([page], { mergeLines: true, preserveLayout: false });

      // Two close lines with same font size should merge
      expect(result[0].lines).toHaveLength(1);
      expect(result[0].lines[0].text).toContain('This is a sentence that');
      expect(result[0].lines[0].text).toContain('continues on the next line.');
    });

    it('should not merge lines when mergeLines is false', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Line one', x: 50, y: 700, fontSize: 12 }),
        makeTextItem({ str: 'Line two', x: 50, y: 686, fontSize: 12 }),
      ]);

      const result = normalizePages([page], { mergeLines: false, preserveLayout: false });

      expect(result[0].lines).toHaveLength(2);
    });

    it('should not merge lines with different font sizes (heading vs body)', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Heading', x: 50, y: 700, fontSize: 24, fontName: 'Helvetica-Bold' }),
        makeTextItem({ str: 'Body text', x: 50, y: 670, fontSize: 12 }),
      ]);

      const result = normalizePages([page], { mergeLines: true, preserveLayout: false });

      expect(result[0].lines).toHaveLength(2);
    });
  });

  describe('preserve layout mode', () => {
    it('should keep all lines separate when preserveLayout is true', () => {
      const page = makePage(1, [
        makeTextItem({ str: 'Line 1', x: 50, y: 700, fontSize: 12 }),
        makeTextItem({ str: 'Line 2', x: 50, y: 686, fontSize: 12 }),
        makeTextItem({ str: 'Line 3', x: 50, y: 672, fontSize: 12 }),
      ]);

      const result = normalizePages([page], { mergeLines: true, preserveLayout: true });

      expect(result[0].lines).toHaveLength(3);
    });
  });

  describe('multi-page handling', () => {
    it('should normalize each page independently', () => {
      const pages = [
        makePage(1, [makeTextItem({ str: 'Page 1', x: 50, y: 700 })]),
        makePage(2, [makeTextItem({ str: 'Page 2', x: 50, y: 700 })]),
      ];

      const result = normalizePages(pages, defaultOptions);

      expect(result).toHaveLength(2);
      expect(result[0].pageNumber).toBe(1);
      expect(result[1].pageNumber).toBe(2);
      expect(result[0].lines[0].text).toBe('Page 1');
      expect(result[1].lines[0].text).toBe('Page 2');
    });
  });

  describe('empty content', () => {
    it('should return empty lines for a page with no text items', () => {
      const page = makePage(1, []);

      const result = normalizePages([page], defaultOptions);

      expect(result[0].lines).toHaveLength(0);
    });

    it('should handle empty string text items', () => {
      const page = makePage(1, [
        makeTextItem({ str: '', x: 50, y: 700 }),
      ]);

      const result = normalizePages([page], defaultOptions);

      // Empty items should be filtered or result in empty line
      expect(result[0].lines).toHaveLength(0);
    });
  });
});
