/**
 * Unit tests for TableDetector service.
 * TDD: These tests are written FIRST, before the implementation.
 *
 * Tests cover:
 * - Column boundary detection from X-coordinate gaps
 * - Row grouping by Y-coordinate proximity
 * - Table region identification with consistent column alignment
 * - Cell extraction to row/col positions
 * - Minimum 2×2 grid validation
 * - Rejection of paragraph indentation false positives
 */

import { describe, it, expect } from 'vitest';
import { detectTables } from '../../src/services/table-detector';
import { NormalizedLine, NormalizedPage } from '../../src/models/types';

/**
 * Helper to create a NormalizedLine with defaults.
 */
function makeLine(overrides: Partial<NormalizedLine> & { text: string }): NormalizedLine {
  return {
    x: 0,
    y: 0,
    fontSize: 12,
    isBold: false,
    isItalic: false,
    isMonospace: false,
    items: [],
    ...overrides,
  };
}

/**
 * Helper to create lines that look like a table row.
 * Simulates multiple text items spread across X-coordinate columns.
 */
function makeTableRow(
  y: number,
  cells: { x: number; text: string }[],
  fontSize = 12
): NormalizedLine {
  return {
    text: cells.map((c) => c.text).join('  '),
    x: cells[0].x,
    y,
    fontSize,
    isBold: false,
    isItalic: false,
    isMonospace: false,
    items: cells.map((c) => ({
      str: c.text,
      x: c.x,
      y,
      width: c.text.length * 6, // approximate
      height: fontSize,
      fontName: 'Helvetica',
      fontSize,
      hasEOL: false,
    })),
  };
}

describe('TableDetector', () => {
  describe('basic table detection', () => {
    it('should detect a simple 3-column, 3-row table', () => {
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'Name' },
          { x: 200, text: 'Age' },
          { x: 350, text: 'City' },
        ]),
        makeTableRow(680, [
          { x: 50, text: 'Alice' },
          { x: 200, text: '30' },
          { x: 350, text: 'NYC' },
        ]),
        makeTableRow(660, [
          { x: 50, text: 'Bob' },
          { x: 200, text: '25' },
          { x: 350, text: 'LA' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(['Name', 'Age', 'City']);
      expect(tables[0].rows).toHaveLength(2);
      expect(tables[0].rows[0]).toEqual(['Alice', '30', 'NYC']);
      expect(tables[0].rows[1]).toEqual(['Bob', '25', 'LA']);
    });

    it('should detect a 2-column, 2-row table (minimum valid)', () => {
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'Key' },
          { x: 200, text: 'Value' },
        ]),
        makeTableRow(680, [
          { x: 50, text: 'foo' },
          { x: 200, text: 'bar' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(['Key', 'Value']);
      expect(tables[0].rows).toHaveLength(1);
      expect(tables[0].rows[0]).toEqual(['foo', 'bar']);
    });

    it('should detect a 4-column table with multiple rows', () => {
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'ID' },
          { x: 150, text: 'Name' },
          { x: 300, text: 'Email' },
          { x: 500, text: 'Role' },
        ]),
        makeTableRow(680, [
          { x: 50, text: '1' },
          { x: 150, text: 'Alice' },
          { x: 300, text: 'alice@example.com' },
          { x: 500, text: 'Admin' },
        ]),
        makeTableRow(660, [
          { x: 50, text: '2' },
          { x: 150, text: 'Bob' },
          { x: 300, text: 'bob@example.com' },
          { x: 500, text: 'User' },
        ]),
        makeTableRow(640, [
          { x: 50, text: '3' },
          { x: 150, text: 'Charlie' },
          { x: 300, text: 'charlie@example.com' },
          { x: 500, text: 'User' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(['ID', 'Name', 'Email', 'Role']);
      expect(tables[0].rows).toHaveLength(3);
    });
  });

  describe('line index tracking', () => {
    it('should correctly set startLineIndex and endLineIndex', () => {
      // Paragraph line before the table
      const lines: NormalizedLine[] = [
        makeLine({ text: 'Some intro paragraph', x: 50, y: 720, items: [
          { str: 'Some intro paragraph', x: 50, y: 720, width: 200, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        makeTableRow(700, [
          { x: 50, text: 'Col1' },
          { x: 200, text: 'Col2' },
        ]),
        makeTableRow(680, [
          { x: 50, text: 'Val1' },
          { x: 200, text: 'Val2' },
        ]),
        makeLine({ text: 'Another paragraph', x: 50, y: 660, items: [
          { str: 'Another paragraph', x: 50, y: 660, width: 170, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].startLineIndex).toBe(1);
      expect(tables[0].endLineIndex).toBe(2);
    });
  });

  describe('minimum grid validation', () => {
    it('should reject a single-column layout (not a table)', () => {
      const lines: NormalizedLine[] = [
        makeLine({ text: 'Line 1', x: 50, y: 700, items: [
          { str: 'Line 1', x: 50, y: 700, width: 60, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        makeLine({ text: 'Line 2', x: 50, y: 680, items: [
          { str: 'Line 2', x: 50, y: 680, width: 60, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        makeLine({ text: 'Line 3', x: 50, y: 660, items: [
          { str: 'Line 3', x: 50, y: 660, width: 60, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(0);
    });

    it('should reject a single-row multi-column layout (not a table)', () => {
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'Only' },
          { x: 200, text: 'One' },
          { x: 350, text: 'Row' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(0);
    });
  });

  describe('false positive rejection', () => {
    it('should reject paragraph indentation as a table', () => {
      // Paragraphs with varying indentation should not be detected as tables
      const lines: NormalizedLine[] = [
        makeLine({ text: 'This is a paragraph of text that spans across the page', x: 50, y: 700, items: [
          { str: 'This is a paragraph of text that spans across the page', x: 50, y: 700, width: 400, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        makeLine({ text: 'with some continuation text that follows naturally', x: 50, y: 680, items: [
          { str: 'with some continuation text that follows naturally', x: 50, y: 680, width: 380, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        makeLine({ text: 'and more continuation here on another line', x: 50, y: 660, items: [
          { str: 'and more continuation here on another line', x: 50, y: 660, width: 340, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(0);
    });

    it('should reject lines with inconsistent column counts', () => {
      // Mixed line structures: some with 2 items, some with 3
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'A' },
          { x: 200, text: 'B' },
          { x: 350, text: 'C' },
        ]),
        makeTableRow(680, [
          { x: 50, text: 'D' },
          { x: 200, text: 'E' },
        ]),
        makeTableRow(660, [
          { x: 50, text: 'F' },
          { x: 200, text: 'G' },
          { x: 350, text: 'H' },
          { x: 500, text: 'I' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      // Should not detect this inconsistent structure as a single table
      expect(tables).toHaveLength(0);
    });
  });

  describe('table mixed with text', () => {
    it('should detect table surrounded by regular text', () => {
      const lines: NormalizedLine[] = [
        // Paragraph before
        makeLine({ text: 'Here is some introductory text.', x: 50, y: 740, items: [
          { str: 'Here is some introductory text.', x: 50, y: 740, width: 300, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
        // Table
        makeTableRow(700, [
          { x: 50, text: 'Header1' },
          { x: 200, text: 'Header2' },
        ]),
        makeTableRow(680, [
          { x: 50, text: 'Data1' },
          { x: 200, text: 'Data2' },
        ]),
        makeTableRow(660, [
          { x: 50, text: 'Data3' },
          { x: 200, text: 'Data4' },
        ]),
        // Paragraph after
        makeLine({ text: 'Some text after the table.', x: 50, y: 630, items: [
          { str: 'Some text after the table.', x: 50, y: 630, width: 240, height: 12, fontName: 'Helvetica', fontSize: 12, hasEOL: false },
        ] }),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].startLineIndex).toBe(1);
      expect(tables[0].endLineIndex).toBe(3);
      expect(tables[0].headers).toEqual(['Header1', 'Header2']);
      expect(tables[0].rows).toHaveLength(2);
    });
  });

  describe('multi-page tables', () => {
    it('should detect tables on different pages independently', () => {
      const page1: NormalizedPage = {
        pageNumber: 1,
        lines: [
          makeTableRow(700, [
            { x: 50, text: 'P1H1' },
            { x: 200, text: 'P1H2' },
          ]),
          makeTableRow(680, [
            { x: 50, text: 'P1D1' },
            { x: 200, text: 'P1D2' },
          ]),
        ],
      };

      const page2: NormalizedPage = {
        pageNumber: 2,
        lines: [
          makeTableRow(700, [
            { x: 50, text: 'P2H1' },
            { x: 200, text: 'P2H2' },
            { x: 350, text: 'P2H3' },
          ]),
          makeTableRow(680, [
            { x: 50, text: 'P2D1' },
            { x: 200, text: 'P2D2' },
            { x: 350, text: 'P2D3' },
          ]),
        ],
      };

      const tables = detectTables([page1, page2]);

      expect(tables).toHaveLength(2);
      expect(tables[0].headers).toEqual(['P1H1', 'P1H2']);
      expect(tables[1].headers).toEqual(['P2H1', 'P2H2', 'P2H3']);
    });
  });

  describe('empty and edge cases', () => {
    it('should return empty array for empty pages', () => {
      const tables = detectTables([]);
      expect(tables).toEqual([]);
    });

    it('should return empty array for pages with no lines', () => {
      const page: NormalizedPage = { pageNumber: 1, lines: [] };
      const tables = detectTables([page]);
      expect(tables).toEqual([]);
    });

    it('should handle lines with empty items array', () => {
      const lines: NormalizedLine[] = [
        makeLine({ text: 'Just text', x: 50, y: 700 }),
        makeLine({ text: 'More text', x: 50, y: 680 }),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(0);
    });
  });

  describe('column boundary tolerance', () => {
    it('should group slightly misaligned columns together', () => {
      // Real PDFs have slight X-coordinate misalignment between rows
      const lines: NormalizedLine[] = [
        makeTableRow(700, [
          { x: 50, text: 'Name' },
          { x: 201, text: 'Age' },
        ]),
        makeTableRow(680, [
          { x: 52, text: 'Alice' },
          { x: 199, text: '30' },
        ]),
        makeTableRow(660, [
          { x: 49, text: 'Bob' },
          { x: 203, text: '25' },
        ]),
      ];

      const page: NormalizedPage = { pageNumber: 1, lines };
      const tables = detectTables([page]);

      expect(tables).toHaveLength(1);
      expect(tables[0].headers).toEqual(['Name', 'Age']);
      expect(tables[0].rows).toHaveLength(2);
    });
  });
});
