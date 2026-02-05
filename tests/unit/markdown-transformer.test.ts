import { describe, it, expect } from 'vitest';
import { transformToMarkdown } from '../../src/services/markdown-transformer';
import { NormalizedLine, NormalizedPage, TransformerOptions } from '../../src/models/types';

/** Helper to create a NormalizedLine with defaults. */
function makeLine(overrides: Partial<NormalizedLine>): NormalizedLine {
  return {
    text: '',
    x: 50,
    y: 700,
    fontSize: 12,
    isBold: false,
    isItalic: false,
    isMonospace: false,
    items: [],
    ...overrides,
  };
}

/** Helper to create a NormalizedPage. */
function makePage(pageNumber: number, lines: NormalizedLine[]): NormalizedPage {
  return { pageNumber, lines };
}

const defaultOptions: TransformerOptions = {
  detectTables: false,
  preserveLayout: false,
};

describe('transformToMarkdown', () => {
  describe('heading detection', () => {
    it('should convert large bold text to # heading', () => {
      const page = makePage(1, [
        makeLine({ text: 'Main Title', fontSize: 24, isBold: true }),
        makeLine({ text: 'Some body text', fontSize: 12 }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('# Main Title');
    });

    it('should convert medium bold text to ## heading', () => {
      const page = makePage(1, [
        makeLine({ text: 'Main Title', fontSize: 24, isBold: true }),
        makeLine({ text: 'Section Title', fontSize: 18, isBold: true }),
        makeLine({ text: 'Some body text', fontSize: 12 }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('## Section Title');
    });

    it('should convert smaller bold text to ### heading', () => {
      const page = makePage(1, [
        makeLine({ text: 'Main Title', fontSize: 24, isBold: true }),
        makeLine({ text: 'Section', fontSize: 18, isBold: true }),
        makeLine({ text: 'Subsection', fontSize: 14, isBold: true }),
        makeLine({ text: 'Body text', fontSize: 12 }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('### Subsection');
    });
  });

  describe('bold formatting', () => {
    it('should wrap bold body text in ** markers', () => {
      const page = makePage(1, [
        makeLine({ text: 'Important text', fontSize: 12, isBold: true }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('**Important text**');
    });
  });

  describe('italic formatting', () => {
    it('should wrap italic text in _ markers', () => {
      const page = makePage(1, [
        makeLine({ text: 'Emphasized text', fontSize: 12, isItalic: true }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('_Emphasized text_');
    });
  });

  describe('bold + italic combined', () => {
    it('should wrap bold+italic text in **_ markers', () => {
      const page = makePage(1, [
        makeLine({ text: 'Strong emphasis', fontSize: 12, isBold: true, isItalic: true }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('**_Strong emphasis_**');
    });
  });

  describe('list detection', () => {
    it('should detect unordered list items starting with bullet markers', () => {
      const page = makePage(1, [
        makeLine({ text: '• First item' }),
        makeLine({ text: '• Second item' }),
        makeLine({ text: '• Third item' }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('- First item');
      expect(result).toContain('- Second item');
      expect(result).toContain('- Third item');
    });

    it('should detect unordered list items with dash markers', () => {
      const page = makePage(1, [
        makeLine({ text: '- First item' }),
        makeLine({ text: '- Second item' }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('- First item');
      expect(result).toContain('- Second item');
    });

    it('should detect ordered list items', () => {
      const page = makePage(1, [
        makeLine({ text: '1. First item' }),
        makeLine({ text: '2. Second item' }),
        makeLine({ text: '3. Third item' }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('1. First item');
      expect(result).toContain('2. Second item');
      expect(result).toContain('3. Third item');
    });
  });

  describe('code block detection', () => {
    it('should wrap consecutive monospace lines in fenced code blocks', () => {
      const page = makePage(1, [
        makeLine({ text: 'const x = 1;', isMonospace: true }),
        makeLine({ text: 'const y = 2;', isMonospace: true }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('```');
      expect(result).toContain('const x = 1;');
      expect(result).toContain('const y = 2;');
    });

    it('should close a code block when monospace ends', () => {
      const page = makePage(1, [
        makeLine({ text: 'Some code', isMonospace: true }),
        makeLine({ text: 'Regular text', isMonospace: false }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      const codeBlockStart = result.indexOf('```');
      const codeBlockEnd = result.indexOf('```', codeBlockStart + 3);
      expect(codeBlockStart).toBeGreaterThanOrEqual(0);
      expect(codeBlockEnd).toBeGreaterThan(codeBlockStart);
    });
  });

  describe('link extraction', () => {
    it('should detect URLs and format as Markdown links', () => {
      const page = makePage(1, [
        makeLine({ text: 'Visit https://example.com for details' }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('[https://example.com](https://example.com)');
    });

    it('should detect HTTP URLs', () => {
      const page = makePage(1, [
        makeLine({ text: 'Go to http://test.org now' }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      expect(result).toContain('[http://test.org](http://test.org)');
    });
  });

  describe('paragraph separation', () => {
    it('should separate regular paragraphs with blank lines', () => {
      const page = makePage(1, [
        makeLine({ text: 'First paragraph', y: 700 }),
        makeLine({ text: 'Second paragraph', y: 650 }),
      ]);

      const result = transformToMarkdown([page], defaultOptions);

      const lines = result.split('\n');
      const firstIdx = lines.findIndex((l) => l.includes('First paragraph'));
      const secondIdx = lines.findIndex((l) => l.includes('Second paragraph'));
      // There should be at least one blank line between paragraphs
      expect(secondIdx).toBeGreaterThan(firstIdx + 1);
    });
  });

  describe('multi-page handling', () => {
    it('should combine content from multiple pages', () => {
      const pages = [
        makePage(1, [makeLine({ text: 'Page 1 content' })]),
        makePage(2, [makeLine({ text: 'Page 2 content' })]),
      ];

      const result = transformToMarkdown(pages, defaultOptions);

      expect(result).toContain('Page 1 content');
      expect(result).toContain('Page 2 content');
    });
  });

  describe('empty content', () => {
    it('should return empty string for empty pages', () => {
      const result = transformToMarkdown([], defaultOptions);
      expect(result.trim()).toBe('');
    });

    it('should return empty string for pages with no lines', () => {
      const result = transformToMarkdown([makePage(1, [])], defaultOptions);
      expect(result.trim()).toBe('');
    });
  });
});
