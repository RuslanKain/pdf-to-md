/**
 * Font name parsing utilities.
 * Detects bold, italic, and monospace properties from PDF font names.
 * Pure TypeScript — no vscode imports.
 */

import { FontMetadata } from '../models/types';

/**
 * Known monospace font family names and substrings.
 * Case-insensitive matching is applied.
 */
const MONOSPACE_PATTERNS: string[] = [
  'courier',
  'consolas',
  'mono',
  'menlo',
  'code',
  'inconsolata',
  'firacode',
  'hackfont',
  'droid sans mono',
  'liberation mono',
  'lucida console',
  'andale mono',
  'ubuntu mono',
  'roboto mono',
  'jetbrains',
  'terminal',
  'fixedsys',
];

/**
 * Bold indicators found in PDF font names.
 * Case-insensitive matching is applied.
 */
const BOLD_PATTERNS: string[] = [
  'bold',
  'heavy',
  'black',
  'semibold',
  'demibold',
  'extrabold',
  'ultrabold',
];

/**
 * Italic indicators found in PDF font names.
 * Case-insensitive matching is applied.
 */
const ITALIC_PATTERNS: string[] = [
  'italic',
  'oblique',
  'inclined',
  'slanted',
];

/**
 * Parse a PDF font name and detect its style properties.
 *
 * @param fontName - The font name string from pdfjs-dist (e.g., "TimesNewRoman-BoldItalic")
 * @param fontFamily - Optional fontFamily from pdfjs-dist styles (e.g., "monospace", "sans-serif")
 * @returns FontMetadata with name, isBold, isItalic, isMonospace flags
 */
export function parseFontName(fontName: string, fontFamily?: string): FontMetadata {
  const lowerName = fontName.toLowerCase();

  const isBold = BOLD_PATTERNS.some((pattern) => lowerName.includes(pattern));
  const isItalic = ITALIC_PATTERNS.some((pattern) => lowerName.includes(pattern));

  // Detect monospace from font name patterns OR from pdfjs-dist fontFamily
  let isMonospace = MONOSPACE_PATTERNS.some((pattern) => lowerName.includes(pattern));
  if (!isMonospace && fontFamily) {
    isMonospace = fontFamily.toLowerCase() === 'monospace';
  }

  return {
    name: fontName,
    isBold,
    isItalic,
    isMonospace,
  };
}
