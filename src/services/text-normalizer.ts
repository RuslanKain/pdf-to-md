/**
 * Text normalization service.
 * Groups raw text items into semantic lines, detects fonts,
 * and optionally merges broken lines into paragraphs.
 * Pure TypeScript — no vscode imports.
 */

import {
  ExtractedPage,
  ExtractedTextItem,
  NormalizedLine,
  NormalizedPage,
  NormalizerOptions,
} from '../models/types';
import { parseFontName } from '../utils/font-utils';

/**
 * Y-coordinate tolerance for grouping text items into the same line.
 * Items within this fraction of their font height are considered same-line.
 */
const Y_TOLERANCE_FACTOR = 0.5;

/**
 * Line spacing threshold factor for merging.
 * If the gap between two lines is less than this multiple of the font size,
 * they are candidates for merging into a paragraph.
 */
const MERGE_LINE_SPACING_FACTOR = 1.5;

/**
 * Group text items into lines, detect font properties, and optionally
 * merge broken lines into coherent paragraphs.
 */
export function normalizePages(
  pages: ExtractedPage[],
  options: NormalizerOptions
): NormalizedPage[] {
  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    lines: normalizePage(page.textItems, options),
  }));
}

function normalizePage(
  textItems: ExtractedTextItem[],
  options: NormalizerOptions
): NormalizedLine[] {
  // Filter out empty text items
  const filtered = textItems.filter((item) => item.str.trim().length > 0);

  if (filtered.length === 0) {
    return [];
  }

  // Group items into lines by Y-coordinate
  const rawLines = groupIntoLines(filtered);

  // Detect font properties for each line
  const normalizedLines = rawLines.map((lineItems) => buildNormalizedLine(lineItems));

  // Sort lines from top to bottom (descending Y in PDF coordinates)
  normalizedLines.sort((a, b) => b.y - a.y);

  // Optionally merge lines
  if (options.preserveLayout) {
    return normalizedLines;
  }

  if (options.mergeLines) {
    return mergeLines(normalizedLines);
  }

  return normalizedLines;
}

/**
 * Group text items into lines based on similar Y-coordinates.
 * Items within Y tolerance of each other are placed on the same line.
 */
function groupIntoLines(items: ExtractedTextItem[]): ExtractedTextItem[][] {
  // Sort by Y descending (top of page first), then X ascending
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > a.height * Y_TOLERANCE_FACTOR) {
      return b.y - a.y; // Higher Y = top of page
    }
    return a.x - b.x; // Left to right
  });

  const lines: ExtractedTextItem[][] = [];
  let currentLine: ExtractedTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const tolerance = Math.max(item.height, currentLine[0].height) * Y_TOLERANCE_FACTOR;

    if (Math.abs(item.y - currentY) <= tolerance) {
      currentLine.push(item);
    } else {
      // Sort current line by X before finalizing
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }

  // Don't forget the last line
  currentLine.sort((a, b) => a.x - b.x);
  lines.push(currentLine);

  return lines;
}

/**
 * Build a NormalizedLine from a group of text items on the same Y-coordinate.
 */
function buildNormalizedLine(items: ExtractedTextItem[]): NormalizedLine {
  // Combine text from all items, adding spaces where there are gaps
  const text = joinItemsWithSpaces(items);

  // Use the first item's position as the line position
  const x = items[0].x;
  const y = items[0].y;

  // Determine dominant font properties (majority vote)
  let totalFontSize = 0;
  let boldCount = 0;
  let italicCount = 0;
  let monoCount = 0;

  for (const item of items) {
    const strLen = item.str.length || 1;
    const fontMeta = parseFontName(item.fontName, item.fontFamily);

    totalFontSize += item.fontSize * strLen;

    if (fontMeta.isBold) boldCount += strLen;
    if (fontMeta.isItalic) italicCount += strLen;
    if (fontMeta.isMonospace) monoCount += strLen;
  }

  const totalChars = items.reduce((sum, item) => sum + (item.str.length || 1), 0);
  const avgFontSize = totalFontSize / totalChars;

  return {
    text,
    x,
    y,
    fontSize: Math.round(avgFontSize * 100) / 100,
    isBold: boldCount > totalChars / 2,
    isItalic: italicCount > totalChars / 2,
    isMonospace: monoCount > totalChars / 2,
    items,
  };
}

/**
 * Join text items into a string, inserting spaces where there are
 * significant X-coordinate gaps between consecutive items.
 * This prevents "Bold textanditalic text" from being concatenated
 * when items come from different font runs.
 */
function joinItemsWithSpaces(items: ExtractedTextItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].str;

  let result = items[0].str;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];

    // If the current item already starts with a space, or the previous ends with a space, just concat
    if (curr.str.startsWith(' ') || prev.str.endsWith(' ') || curr.str === '' || prev.str === '') {
      result += curr.str;
      continue;
    }

    // Check if there's a gap between items that suggests a space
    const prevEnd = prev.x + prev.width;
    const gap = curr.x - prevEnd;
    const spaceThreshold = curr.fontSize * 0.15; // ~15% of font size

    if (gap > spaceThreshold) {
      result += ' ' + curr.str;
    } else {
      result += curr.str;
    }
  }
  return result;
}

/**
 * Merge consecutive lines that appear to be part of the same paragraph.
 * Lines are merged when they have similar font size, similar X position,
 * and the Y gap is within the expected line spacing.
 */
function mergeLines(lines: NormalizedLine[]): NormalizedLine[] {
  if (lines.length <= 1) return lines;

  const merged: NormalizedLine[] = [];
  let current = lines[0];

  for (let i = 1; i < lines.length; i++) {
    const next = lines[i];

    if (shouldMerge(current, next)) {
      // Merge next into current
      current = {
        ...current,
        text: current.text + ' ' + next.text,
        items: [...current.items, ...next.items],
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/** Characters that commonly represent bullet points in PDF text extraction. */
const BULLET_CHARS = new Set('\u2022\u25CF\u25E6\u25AA\u25B8\u2023\u2043\u2013\u2014\u201C\u201D\u2018\u2019\u00B7"');

/**
 * Determine whether two consecutive lines should be merged into a paragraph.
 */
function shouldMerge(current: NormalizedLine, next: NormalizedLine): boolean {
  // Don't merge if the next line starts with a bullet character
  const firstChar = next.text.trimStart().charAt(0);
  if (BULLET_CHARS.has(firstChar)) return false;

  // Don't merge lines with significantly different font sizes
  const fontSizeRatio = Math.abs(current.fontSize - next.fontSize) / Math.max(current.fontSize, 1);
  if (fontSizeRatio > 0.15) return false;

  // Don't merge lines with different bold/italic properties
  if (current.isBold !== next.isBold) return false;
  if (current.isItalic !== next.isItalic) return false;

  // Don't merge monospace lines (likely code blocks)
  if (current.isMonospace || next.isMonospace) return false;

  // Check Y gap — should be within normal line spacing
  const yGap = Math.abs(current.y - next.y);
  const expectedSpacing = current.fontSize * MERGE_LINE_SPACING_FACTOR;

  if (yGap > expectedSpacing) return false;

  return true;
}
