import { describe, it, expect } from 'vitest';
import { parseFontName } from '../../src/utils/font-utils';

describe('parseFontName', () => {
  describe('bold detection', () => {
    it('should detect bold from font name containing "Bold"', () => {
      const result = parseFontName('TimesNewRoman-Bold');
      expect(result.isBold).toBe(true);
      expect(result.isItalic).toBe(false);
    });

    it('should detect bold from font name containing "bold" (case-insensitive)', () => {
      const result = parseFontName('arial-bold');
      expect(result.isBold).toBe(true);
    });

    it('should detect bold from font name containing "Heavy"', () => {
      const result = parseFontName('Helvetica-Heavy');
      expect(result.isBold).toBe(true);
    });

    it('should detect bold from font name containing "Black"', () => {
      const result = parseFontName('Arial-Black');
      expect(result.isBold).toBe(true);
    });

    it('should not detect bold from regular font name', () => {
      const result = parseFontName('TimesNewRoman');
      expect(result.isBold).toBe(false);
    });
  });

  describe('italic detection', () => {
    it('should detect italic from font name containing "Italic"', () => {
      const result = parseFontName('Arial-Italic');
      expect(result.isItalic).toBe(true);
      expect(result.isBold).toBe(false);
    });

    it('should detect italic from font name containing "Oblique"', () => {
      const result = parseFontName('Helvetica-Oblique');
      expect(result.isItalic).toBe(true);
    });

    it('should detect italic from font name containing "Inclined"', () => {
      const result = parseFontName('SomeFont-Inclined');
      expect(result.isItalic).toBe(true);
    });

    it('should not detect italic from regular font name', () => {
      const result = parseFontName('Arial');
      expect(result.isItalic).toBe(false);
    });
  });

  describe('monospace detection', () => {
    it('should detect monospace from "Courier"', () => {
      const result = parseFontName('Courier');
      expect(result.isMonospace).toBe(true);
    });

    it('should detect monospace from "Courier-Bold"', () => {
      const result = parseFontName('Courier-Bold');
      expect(result.isMonospace).toBe(true);
      expect(result.isBold).toBe(true);
    });

    it('should detect monospace from "Consolas"', () => {
      const result = parseFontName('Consolas');
      expect(result.isMonospace).toBe(true);
    });

    it('should detect monospace from font name containing "Mono"', () => {
      const result = parseFontName('DejaVuSansMono');
      expect(result.isMonospace).toBe(true);
    });

    it('should detect monospace from "Menlo"', () => {
      const result = parseFontName('Menlo-Regular');
      expect(result.isMonospace).toBe(true);
    });

    it('should detect monospace from font name containing "Code"', () => {
      const result = parseFontName('SourceCodePro-Regular');
      expect(result.isMonospace).toBe(true);
    });

    it('should not detect monospace from proportional font', () => {
      const result = parseFontName('Arial');
      expect(result.isMonospace).toBe(false);
    });
  });

  describe('combined styles', () => {
    it('should detect bold and italic combined', () => {
      const result = parseFontName('TimesNewRoman-BoldItalic');
      expect(result.isBold).toBe(true);
      expect(result.isItalic).toBe(true);
      expect(result.isMonospace).toBe(false);
    });

    it('should detect bold and monospace combined', () => {
      const result = parseFontName('Courier-Bold');
      expect(result.isBold).toBe(true);
      expect(result.isMonospace).toBe(true);
    });

    it('should detect all three combined', () => {
      const result = parseFontName('CourierNew-BoldItalic');
      expect(result.isBold).toBe(true);
      expect(result.isItalic).toBe(true);
      expect(result.isMonospace).toBe(true);
    });
  });

  describe('font name preservation', () => {
    it('should preserve the original font name in the result', () => {
      const result = parseFontName('TimesNewRoman-Bold');
      expect(result.name).toBe('TimesNewRoman-Bold');
    });

    it('should handle empty font name', () => {
      const result = parseFontName('');
      expect(result.name).toBe('');
      expect(result.isBold).toBe(false);
      expect(result.isItalic).toBe(false);
      expect(result.isMonospace).toBe(false);
    });

    it('should handle font names with prefixes like g_d_0_f1', () => {
      const result = parseFontName('g_d_0_f1');
      expect(result.isBold).toBe(false);
      expect(result.isItalic).toBe(false);
      expect(result.isMonospace).toBe(false);
    });
  });
});
