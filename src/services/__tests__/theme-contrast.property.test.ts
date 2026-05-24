/**
 * Property 12: 深色主题文字对比度
 * **Validates: Requirements 6.5**
 *
 * For any text color and background color combination used in the application,
 * the calculated contrast ratio SHALL be ≥ 4.5:1 (WCAG AA standard).
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ===== WCAG Contrast Ratio Calculation =====

/**
 * Parse a hex color string to RGB components (0-255).
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/**
 * Convert an sRGB component (0-255) to its linear value.
 * Per WCAG 2.0 relative luminance formula.
 */
function srgbToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance of a color per WCAG 2.0.
 * Returns a value between 0 (darkest) and 1 (lightest).
 */
function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Calculate WCAG contrast ratio between two colors.
 * Returns a value between 1 and 21.
 */
function getContrastRatio(foreground: string, background: string): number {
  const fgLuminance = getRelativeLuminance(foreground);
  const bgLuminance = getRelativeLuminance(background);
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

// ===== Application Color Pairs =====

/**
 * All text/background color pairs used in the dark theme.
 */
const APP_COLOR_PAIRS: Array<{ foreground: string; background: string; description: string }> = [
  { foreground: '#FFFFFF', background: '#0D0D0D', description: 'primary text on main background' },
  { foreground: '#B3B3B3', background: '#0D0D0D', description: 'secondary text on main background' },
  { foreground: '#FFFFFF', background: '#1A1A2E', description: 'primary text on surface' },
  { foreground: '#B3B3B3', background: '#1A1A2E', description: 'secondary text on surface' },
  { foreground: '#1DB954', background: '#0D0D0D', description: 'primary color on main background' },
  { foreground: '#EC2466', background: '#0D0D0D', description: 'accent color on main background' },
];

const WCAG_AA_MIN_CONTRAST = 4.5;

// ===== Dark backgrounds used in the app =====
const DARK_BACKGROUNDS = ['#0D0D0D', '#1A1A2E'];

describe('Property 12: 深色主题文字对比度', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * Each defined text/background color pair in the application SHALL have
   * a contrast ratio ≥ 4.5:1 (WCAG AA standard).
   */
  it('all app color pairs should have contrast ratio ≥ 4.5:1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: APP_COLOR_PAIRS.length - 1 }),
        (index: number) => {
          const pair = APP_COLOR_PAIRS[index];
          const ratio = getContrastRatio(pair.foreground, pair.background);

          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.5**
   *
   * For any generated text color with relative luminance > 0.5 on the dark
   * backgrounds used in the app, the contrast ratio should be sufficient (≥ 4.5:1).
   */
  it('any light text color (luminance > 0.5) on dark backgrounds should have sufficient contrast', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 128, max: 255 }),
        fc.integer({ min: 128, max: 255 }),
        fc.integer({ min: 128, max: 255 }),
        fc.constantFrom(...DARK_BACKGROUNDS),
        (r: number, g: number, b: number, background: string) => {
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          const luminance = getRelativeLuminance(hex);

          // Only test colors with luminance > 0.5 (light colors)
          if (luminance <= 0.5) {
            return; // skip - not a light enough color
          }

          const ratio = getContrastRatio(hex, background);
          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_CONTRAST);
        }
      ),
      { numRuns: 100 }
    );
  });
});
