import { describe, it, expect } from 'vitest';
import { sortBlocksForReadingOrder } from '../../src/services/mupdf-extractor';
import { Block, TextBlock, BBox } from '../../src/models/types';

function textBlock(text: string, bbox: BBox): TextBlock {
  return {
    type: 'text',
    bbox,
    lines: [
      {
        bbox,
        text,
        fontSize: 12,
        isBold: false,
        isItalic: false,
        isMonospace: false,
        spans: [],
      },
    ],
    fontSize: 12,
    isBold: false,
    isItalic: false,
    isMonospace: false,
  };
}

function texts(blocks: Block[]): string[] {
  return blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.lines[0]?.text ?? '');
}

describe('sortBlocksForReadingOrder', () => {
  it('keeps top full-width block before two-column body', () => {
    const pageWidth = 600;
    const blocks: Block[] = [
      textBlock('R2 top', [320, 120, 560, 150]),
      textBlock('L1 top', [40, 100, 280, 130]),
      textBlock('Title', [40, 20, 560, 80]),
      textBlock('L2', [40, 170, 280, 200]),
      textBlock('R1 top', [320, 110, 560, 140]),
      textBlock('R3', [320, 180, 560, 210]),
      textBlock('L3', [40, 240, 280, 270]),
      textBlock('R4', [320, 240, 560, 270]),
      textBlock('L4', [40, 300, 280, 330]),
      textBlock('Footnote', [40, 700, 560, 740]),
    ];

    const ordered = sortBlocksForReadingOrder(blocks, pageWidth);

    expect(texts(ordered)).toEqual([
      'Title',
      'L1 top',
      'L2',
      'L3',
      'L4',
      'R1 top',
      'R2 top',
      'R3',
      'R4',
      'Footnote',
    ]);
  });

  it('falls back to y-then-x sorting for single-column pages', () => {
    const pageWidth = 600;
    const blocks: Block[] = [
      textBlock('Line 3', [40, 180, 560, 210]),
      textBlock('Line 1', [40, 80, 560, 110]),
      textBlock('Line 2', [40, 130, 560, 160]),
    ];

    const ordered = sortBlocksForReadingOrder(blocks, pageWidth);

    expect(texts(ordered)).toEqual(['Line 1', 'Line 2', 'Line 3']);
  });
});
