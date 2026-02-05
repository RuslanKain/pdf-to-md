/**
 * Table detection service.
 * Uses heuristic analysis of text item X/Y coordinates to detect
 * tabular structures in normalized pages.
 * Pure TypeScript — no vscode imports.
 *
 * Algorithm:
 * 1. For each page, examine lines with multiple text items
 * 2. Detect column boundaries from X-coordinate clustering
 * 3. Find consecutive lines sharing consistent column alignment
 * 4. Validate minimum 2 columns × 2 rows
 * 5. Extract cells into header + data rows
 */

import {
  NormalizedLine,
  NormalizedPage,
  DetectedTable,
} from '../models/types';

/**
 * X-coordinate tolerance for column alignment.
 * Items with X values within this range are considered the same column.
 */
const COLUMN_X_TOLERANCE = 15;

/**
 * Minimum number of columns for a valid table.
 */
const MIN_COLUMNS = 2;

/**
 * Minimum number of rows (including header) for a valid table.
 */
const MIN_ROWS = 2;

/**
 * Detect tables across all pages.
 * Returns DetectedTable[] with global line indices for integration
 * with the MarkdownTransformer.
 */
export function detectTables(pages: NormalizedPage[]): DetectedTable[] {
  if (pages.length === 0) return [];

  const allTables: DetectedTable[] = [];
  let globalLineOffset = 0;

  for (const page of pages) {
    const pageTables = detectTablesInPage(page.lines, globalLineOffset);
    allTables.push(...pageTables);
    globalLineOffset += page.lines.length;
  }

  return allTables;
}

/**
 * Detect tables within a single page's lines.
 * @param lines - Normalized lines for this page
 * @param globalOffset - Offset to convert page-local indices to global indices
 */
function detectTablesInPage(
  lines: NormalizedLine[],
  globalOffset: number
): DetectedTable[] {
  if (lines.length < MIN_ROWS) return [];

  // Step 1: Analyze each line's column structure
  const lineColumnInfos = lines.map((line) => analyzeLineColumns(line));

  // Step 2: Find consecutive runs of lines with consistent column count and alignment
  const tableRegions = findTableRegions(lineColumnInfos);

  // Step 3: Build DetectedTable for each valid region
  const tables: DetectedTable[] = [];
  for (const region of tableRegions) {
    const table = buildTable(lines, lineColumnInfos, region, globalOffset);
    if (table) {
      tables.push(table);
    }
  }

  return tables;
}

/**
 * Information about column structure of a single line.
 */
interface LineColumnInfo {
  /** Number of distinct columns (from text items) */
  columnCount: number;
  /** X positions of each column's start */
  columnXPositions: number[];
  /** Text content of each column */
  columnTexts: string[];
  /** Whether this line has enough items to be part of a table */
  isMultiColumn: boolean;
}

/**
 * Analyze a line's text items to determine column structure.
 * Groups items that are close in X into the same column.
 */
function analyzeLineColumns(line: NormalizedLine): LineColumnInfo {
  if (!line.items || line.items.length === 0) {
    return {
      columnCount: 1,
      columnXPositions: [line.x],
      columnTexts: [line.text],
      isMultiColumn: false,
    };
  }

  // Sort items by X position
  const sorted = [...line.items].sort((a, b) => a.x - b.x);

  // Cluster items into columns based on X-coordinate gaps
  const columns: { x: number; texts: string[] }[] = [];
  let currentColumn: { x: number; texts: string[] } = {
    x: sorted[0].x,
    texts: [sorted[0].str],
  };

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);

    // If the gap is significant (more than the width of a typical space character),
    // this is a new column
    if (gap > sorted[i].fontSize * 2) {
      columns.push(currentColumn);
      currentColumn = { x: sorted[i].x, texts: [sorted[i].str] };
    } else {
      // Same column — concatenate text
      currentColumn.texts.push(sorted[i].str);
    }
  }
  columns.push(currentColumn);

  return {
    columnCount: columns.length,
    columnXPositions: columns.map((c) => c.x),
    columnTexts: columns.map((c) => c.texts.join(' ').trim()),
    isMultiColumn: columns.length >= MIN_COLUMNS,
  };
}

/**
 * Represents a contiguous region of lines that could form a table.
 */
interface TableRegion {
  startIndex: number;
  endIndex: number;
}

/**
 * Find contiguous regions of lines with consistent multi-column structure.
 * Lines must have the same column count and similar column X-positions.
 */
function findTableRegions(lineInfos: LineColumnInfo[]): TableRegion[] {
  const regions: TableRegion[] = [];
  let i = 0;

  while (i < lineInfos.length) {
    // Skip non-multi-column lines
    if (!lineInfos[i].isMultiColumn) {
      i++;
      continue;
    }

    // Start of a potential table region
    const regionStart = i;
    const referenceColumnCount = lineInfos[i].columnCount;
    const referenceXPositions = lineInfos[i].columnXPositions;

    i++;

    // Extend the region while lines have consistent column structure
    while (i < lineInfos.length) {
      const info = lineInfos[i];

      if (!info.isMultiColumn) break;
      if (info.columnCount !== referenceColumnCount) break;

      // Check X-position alignment
      if (!areColumnsAligned(referenceXPositions, info.columnXPositions)) break;

      i++;
    }

    const regionEnd = i - 1;

    // Validate minimum rows
    if (regionEnd - regionStart + 1 >= MIN_ROWS) {
      regions.push({ startIndex: regionStart, endIndex: regionEnd });
    }
  }

  return regions;
}

/**
 * Check if two sets of column X-positions are aligned within tolerance.
 */
function areColumnsAligned(ref: number[], candidate: number[]): boolean {
  if (ref.length !== candidate.length) return false;

  for (let i = 0; i < ref.length; i++) {
    if (Math.abs(ref[i] - candidate[i]) > COLUMN_X_TOLERANCE) {
      return false;
    }
  }

  return true;
}

/**
 * Build a DetectedTable from a validated region.
 */
function buildTable(
  lines: NormalizedLine[],
  lineInfos: LineColumnInfo[],
  region: TableRegion,
  globalOffset: number
): DetectedTable | null {
  const headerInfo = lineInfos[region.startIndex];

  // Extract headers
  const headers = headerInfo.columnTexts;

  // Extract data rows
  const rows: string[][] = [];
  for (let i = region.startIndex + 1; i <= region.endIndex; i++) {
    const rowInfo = lineInfos[i];
    // Pad or trim to match header column count
    const row = [...rowInfo.columnTexts];
    while (row.length < headers.length) {
      row.push('');
    }
    rows.push(row.slice(0, headers.length));
  }

  return {
    startLineIndex: globalOffset + region.startIndex,
    endLineIndex: globalOffset + region.endIndex,
    headers,
    rows,
  };
}
