/**
 * Markdown transformation service.
 * Converts normalized pages into a single CommonMark-compliant Markdown string.
 * Pure TypeScript — no vscode imports.
 */

import {
  ExtractedTextItem,
  NormalizedLine,
  NormalizedPage,
  TransformerOptions,
  DetectedTable,
} from '../models/types';
import { parseFontName } from '../utils/font-utils';

/** URL pattern for link detection. */
const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

/** Bullet list item patterns.
 * Includes curly quotes and ASCII double-quote which some PDFs
 * produce when the font maps the bullet glyph to a quote codepoint.
 */
const BULLET_PATTERN = /^[\u2022\u25CF\u25E6\u25AA\u25B8\u2023\u2043\u2013\u2014\u201C\u201D\u2018\u2019\u00B7\u0022]\s*/;

/** Characters that signal the start of a bullet item (used in merge heuristic). */
const BULLET_CHARS = new Set('\u2022\u25CF\u25E6\u25AA\u25B8\u2023\u2043\u2013\u2014\u201C\u201D\u2018\u2019\u00B7"');

/** Ordered list item pattern (e.g., "1.", "2)", "a."). */
const ORDERED_LIST_PATTERN = /^(\d+)[.)]\s+/;

/** Dash-based list pattern. */
const DASH_LIST_PATTERN = /^-\s+/;

/**
 * Transform normalized pages into a CommonMark Markdown string.
 * Applies heading detection, inline formatting, list detection,
 * code block detection, link extraction, and table rendering.
 */
export function transformToMarkdown(
  pages: NormalizedPage[],
  options: TransformerOptions,
  tables?: DetectedTable[]
): string {
  if (pages.length === 0) return '';

  // Collect all lines across all pages and compute font size hierarchy
  const allLines: NormalizedLine[] = [];
  for (const page of pages) {
    allLines.push(...page.lines);
  }

  if (allLines.length === 0) return '';

  // Build heading size hierarchy from the document's font sizes
  const headingLevels = detectHeadingLevels(allLines);

  // Build a set of line indices that are part of tables
  const tableLineIndices = new Set<number>();
  const tablesByStartLine = new Map<number, DetectedTable>();
  if (options.detectTables && tables) {
    for (const table of tables) {
      tablesByStartLine.set(table.startLineIndex, table);
      for (let i = table.startLineIndex; i <= table.endLineIndex; i++) {
        tableLineIndices.add(i);
      }
    }
  }

  const outputLines: string[] = [];
  let inCodeBlock = false;
  let globalLineIndex = 0;

  for (const page of pages) {
    for (let i = 0; i < page.lines.length; i++) {
      const lineIdx = globalLineIndex + i;

      // Skip lines that are part of a table (handled separately)
      if (tableLineIndices.has(lineIdx)) {
        // If this is the start of a table, render it
        const table = tablesByStartLine.get(lineIdx);
        if (table) {
          if (inCodeBlock) {
            outputLines.push('```');
            outputLines.push('');
            inCodeBlock = false;
          }
          outputLines.push(...renderTable(table));
          outputLines.push('');
        }
        continue;
      }

      const line = page.lines[i];

      // Handle code blocks (consecutive monospace lines)
      if (line.isMonospace) {
        if (!inCodeBlock) {
          outputLines.push('```');
          inCodeBlock = true;
        }
        outputLines.push(line.text);
        continue;
      } else if (inCodeBlock) {
        outputLines.push('```');
        outputLines.push('');
        inCodeBlock = false;
      }

      // Check if this line is a heading
      const headingLevel = getHeadingLevel(line, headingLevels);
      if (headingLevel > 0) {
        outputLines.push(`${'#'.repeat(headingLevel)} ${line.text.trim()}`);
        outputLines.push('');
        continue;
      }

      // Check for list items
      const bulletMatch = line.text.match(BULLET_PATTERN);
      const dashMatch = line.text.match(DASH_LIST_PATTERN);
      const orderedMatch = line.text.match(ORDERED_LIST_PATTERN);

      if (bulletMatch) {
        const content = line.text.slice(bulletMatch[0].length);
        outputLines.push(`- ${formatInlineText(content, line)}`);
        continue;
      }

      if (dashMatch) {
        const content = line.text.slice(dashMatch[0].length);
        outputLines.push(`- ${formatInlineText(content, line)}`);
        continue;
      }

      if (orderedMatch) {
        outputLines.push(formatInlineText(line.text, line));
        continue;
      }

      // Regular paragraph text
      const formatted = formatInlineText(line.text.trim(), line);
      if (formatted) {
        outputLines.push(formatted);
        outputLines.push('');
      }
    }

    globalLineIndex += page.lines.length;

    // Add page separator
    if (pages.indexOf(page) < pages.length - 1) {
      if (inCodeBlock) {
        outputLines.push('```');
        outputLines.push('');
        inCodeBlock = false;
      }
      outputLines.push('');
    }
  }

  // Close any open code block
  if (inCodeBlock) {
    outputLines.push('```');
    outputLines.push('');
  }

  // Clean up excessive blank lines (max 2 consecutive)
  return cleanupOutput(outputLines.join('\n'));
}

/**
 * Detect heading levels based on font size hierarchy in the document.
 * Returns a map of fontSize → heading level (1, 2, or 3).
 */
function detectHeadingLevels(
  lines: NormalizedLine[]
): Map<number, number> {
  // Find the body text font size (most common NON-MONOSPACE line).
  // Excluding monospace prevents code-block text (e.g. 10pt) from
  // becoming the "body" size, which would promote 12pt prose to headings.
  const fontSizeCounts = new Map<number, number>();
  for (const line of lines) {
    if (line.isMonospace) continue; // skip code lines
    const rounded = Math.round(line.fontSize);
    fontSizeCounts.set(rounded, (fontSizeCounts.get(rounded) || 0) + 1);
  }

  // Fallback: if ALL lines are monospace, count every line
  if (fontSizeCounts.size === 0) {
    for (const line of lines) {
      const rounded = Math.round(line.fontSize);
      fontSizeCounts.set(rounded, (fontSizeCounts.get(rounded) || 0) + 1);
    }
  }

  let bodyFontSize = 12;
  let maxCount = 0;
  for (const [size, count] of fontSizeCounts) {
    if (count > maxCount || (count === maxCount && size < bodyFontSize)) {
      maxCount = count;
      bodyFontSize = size;
    }
  }

  // Find distinct font sizes that are at least 15% larger than body text.
  // The 15% minimum gap prevents minor size differences (e.g. 11pt vs 10pt)
  // from being misclassified as headings.
  const minHeadingSize = bodyFontSize * 1.15;
  const headingSizes = new Set<number>();
  for (const line of lines) {
    const rounded = Math.round(line.fontSize);
    if (rounded >= minHeadingSize) {
      headingSizes.add(rounded);
    }
  }

  // Sort heading sizes descending
  const sortedSizes = [...headingSizes].sort((a, b) => b - a);

  const levels = new Map<number, number>();
  for (let i = 0; i < Math.min(sortedSizes.length, 3); i++) {
    levels.set(sortedSizes[i], i + 1);
  }

  return levels;
}

/**
 * Determine the heading level for a line, or 0 if not a heading.
 */
function getHeadingLevel(
  line: NormalizedLine,
  headingLevels: Map<number, number>
): number {
  const rounded = Math.round(line.fontSize);
  return headingLevels.get(rounded) || 0;
}

/**
 * Apply inline formatting (bold, italic, links) to text.
 * Uses per-item font analysis to generate proper inline **bold** and _italic_ spans
 * even when font names are opaque (detects formatting from font-ID changes).
 */
function formatInlineText(text: string, line: NormalizedLine): string {
  let result: string;

  // If line has multiple items with different fonts at the same size,
  // try to produce inline formatting spans
  if (line.items && line.items.length > 1 && hasMultipleFonts(line.items)) {
    result = buildInlineFormattedText(line.items);
  } else {
    result = text;
    // Apply line-level bold/italic
    if (line.isBold && line.isItalic) {
      result = `**_${result}_**`;
    } else if (line.isBold) {
      result = `**${result}**`;
    } else if (line.isItalic) {
      result = `_${result}_`;
    }
  }

  // Extract and format URLs
  result = result.replace(URL_REGEX, (url) => `[${url}](${url})`);

  return result;
}

/**
 * Check if a set of text items uses multiple different font names.
 */
function hasMultipleFonts(items: ExtractedTextItem[]): boolean {
  const fonts = new Set<string>();
  for (const item of items) {
    if (item.str.trim()) fonts.add(item.fontName);
  }
  return fonts.size > 1;
}

/**
 * Build inline formatted text from individual text items.
 * When font names are opaque (e.g., "g_d0_f1", "g_d0_f3"),
 * we detect the "body" font as the most common one and treat
 * other fonts as bold or italic based on average character width
 * (bold glyphs are wider than regular or italic).
 */
function buildInlineFormattedText(items: ExtractedTextItem[]): string {
  // ── 1. Collect per-font metrics ──────────────────────────────
  const fontMetrics = new Map<string, { chars: number; width: number }>();
  for (const item of items) {
    const len = item.str.trim().length;
    if (len === 0) continue;
    const m = fontMetrics.get(item.fontName) || { chars: 0, width: 0 };
    m.chars += len;
    m.width += item.width;
    fontMetrics.set(item.fontName, m);
  }

  // ── 2. Identify the body font (most characters) ─────────────
  let bodyFont = '';
  let maxChars = 0;
  for (const [font, m] of fontMetrics) {
    if (m.chars > maxChars) {
      maxChars = m.chars;
      bodyFont = font;
    }
  }

  if (fontMetrics.size <= 1) {
    return items.map(i => i.str).join('');
  }

  // ── 3. Build spans (consecutive items with the same font) ───
  //    Insert a space between items when there's an X-gap,
  //    whether they share a font or not.
  const spans: { text: string; fontName: string; isBody: boolean; lastItem: ExtractedTextItem }[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item.str) continue;
    const isBody = item.fontName === bodyFont;

    // Decide whether to insert a gap-space before this item
    let gapSpace = '';
    if (idx > 0) {
      const prev = items[idx - 1];
      const prevEnd = prev.x + prev.width;
      const gap = item.x - prevEnd;
      if (
        gap > item.fontSize * 0.15 &&
        !prev.str.endsWith(' ') &&
        !item.str.startsWith(' ')
      ) {
        gapSpace = ' ';
      }
    }

    // Merge with previous span if same font
    if (
      spans.length > 0 &&
      spans[spans.length - 1].fontName === item.fontName
    ) {
      spans[spans.length - 1].text += gapSpace + item.str;
      spans[spans.length - 1].lastItem = item;
    } else {
      // New span — attach gap-space to previous span's trailing edge
      // so the space stays *outside* any formatting markers.
      if (gapSpace && spans.length > 0) {
        spans[spans.length - 1].text += gapSpace;
      }
      spans.push({ text: item.str, fontName: item.fontName, isBody, lastItem: item });
    }
  }

  // ── 4. Assign bold / italic roles to non-body fonts ─────────
  //    Use average character width: bold glyphs are wider.
  const nonBodyFonts = [...fontMetrics.keys()].filter(f => f !== bodyFont);
  const fontRoles = new Map<string, 'bold' | 'italic'>();

  if (nonBodyFonts.length === 1) {
    const meta = parseFontName(nonBodyFonts[0], undefined);
    if (meta.isItalic) {
      fontRoles.set(nonBodyFonts[0], 'italic');
    } else if (meta.isBold) {
      fontRoles.set(nonBodyFonts[0], 'bold');
    } else {
      // Opaque font — compare avg width with body font
      const nbm = fontMetrics.get(nonBodyFonts[0]);
      const bm = fontMetrics.get(bodyFont);
      if (nbm && bm && nbm.chars > 0 && bm.chars > 0) {
        const nbAvg = nbm.width / nbm.chars;
        const bAvg = bm.width / bm.chars;
        fontRoles.set(nonBodyFonts[0], nbAvg >= bAvg ? 'bold' : 'italic');
      } else {
        fontRoles.set(nonBodyFonts[0], 'bold');
      }
    }
  } else {
    // Multiple non-body fonts: wider average = bold, narrower = italic
    const withAvg = nonBodyFonts.map(f => {
      const m = fontMetrics.get(f);
      return { font: f, avg: m && m.chars > 0 ? m.width / m.chars : 0 };
    });
    withAvg.sort((a, b) => b.avg - a.avg); // widest first
    for (let i = 0; i < withAvg.length; i++) {
      fontRoles.set(withAvg[i].font, i === 0 ? 'bold' : 'italic');
    }
  }

  // ── 5. Render spans with Markdown markers ────────────────────
  let result = '';
  for (const span of spans) {
    const trimmedText = span.text.trim();
    const leadingSpace = span.text.startsWith(' ') ? ' ' : '';
    const trailingSpace = span.text.endsWith(' ') ? ' ' : '';

    if (span.isBody || !trimmedText) {
      result += span.text;
    } else {
      const role = fontRoles.get(span.fontName) || 'bold';
      if (role === 'italic') {
        result += `${leadingSpace}_${trimmedText}_${trailingSpace}`;
      } else {
        result += `${leadingSpace}**${trimmedText}**${trailingSpace}`;
      }
    }
  }

  return result;
}

/**
 * Render a detected table as pipe-delimited Markdown.
 */
function renderTable(table: DetectedTable): string[] {
  const lines: string[] = [];

  // Header row
  lines.push('| ' + table.headers.join(' | ') + ' |');

  // Separator row
  lines.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');

  // Data rows
  for (const row of table.rows) {
    // Pad row to match header length
    const paddedRow = [...row];
    while (paddedRow.length < table.headers.length) {
      paddedRow.push('');
    }
    lines.push('| ' + paddedRow.join(' | ') + ' |');
  }

  return lines;
}

/**
 * Clean up output — collapse excessive blank lines.
 */
function cleanupOutput(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
