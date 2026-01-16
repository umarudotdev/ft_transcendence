/**
 * Material Design 3 Typography System
 *
 * Defines the complete MD3 type scale with 15 styles across 5 roles:
 * - Display (large, medium, small)
 * - Headline (large, medium, small)
 * - Title (large, medium, small)
 * - Body (large, medium, small)
 * - Label (large, medium, small)
 *
 * Uses Roboto as the primary typeface.
 */

export interface MD3TypeStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string;
  letterSpacing: string;
}

export interface MD3TypeScale {
  displayLarge: MD3TypeStyle;
  displayMedium: MD3TypeStyle;
  displaySmall: MD3TypeStyle;
  headlineLarge: MD3TypeStyle;
  headlineMedium: MD3TypeStyle;
  headlineSmall: MD3TypeStyle;
  titleLarge: MD3TypeStyle;
  titleMedium: MD3TypeStyle;
  titleSmall: MD3TypeStyle;
  bodyLarge: MD3TypeStyle;
  bodyMedium: MD3TypeStyle;
  bodySmall: MD3TypeStyle;
  labelLarge: MD3TypeStyle;
  labelMedium: MD3TypeStyle;
  labelSmall: MD3TypeStyle;
}

// Font family definitions
export const md3FontFamily = {
  brand: "Roboto, sans-serif",
  plain: "Roboto, sans-serif",
  code: "Roboto Mono, monospace",
};

/**
 * MD3 Type Scale
 *
 * Based on Material Design 3 typography specifications.
 * @see https://m3.material.io/styles/typography/type-scale-tokens
 */
export const md3TypeScale: MD3TypeScale = {
  // Display - Large, prominent text for short important text
  displayLarge: {
    fontFamily: md3FontFamily.brand,
    fontSize: "57px",
    fontWeight: 400,
    lineHeight: "64px",
    letterSpacing: "-0.25px",
  },
  displayMedium: {
    fontFamily: md3FontFamily.brand,
    fontSize: "45px",
    fontWeight: 400,
    lineHeight: "52px",
    letterSpacing: "0px",
  },
  displaySmall: {
    fontFamily: md3FontFamily.brand,
    fontSize: "36px",
    fontWeight: 400,
    lineHeight: "44px",
    letterSpacing: "0px",
  },

  // Headline - High-emphasis text for headlines
  headlineLarge: {
    fontFamily: md3FontFamily.brand,
    fontSize: "32px",
    fontWeight: 400,
    lineHeight: "40px",
    letterSpacing: "0px",
  },
  headlineMedium: {
    fontFamily: md3FontFamily.brand,
    fontSize: "28px",
    fontWeight: 400,
    lineHeight: "36px",
    letterSpacing: "0px",
  },
  headlineSmall: {
    fontFamily: md3FontFamily.brand,
    fontSize: "24px",
    fontWeight: 400,
    lineHeight: "32px",
    letterSpacing: "0px",
  },

  // Title - Medium-emphasis text, card titles
  titleLarge: {
    fontFamily: md3FontFamily.brand,
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: "28px",
    letterSpacing: "0px",
  },
  titleMedium: {
    fontFamily: md3FontFamily.plain,
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: "24px",
    letterSpacing: "0.15px",
  },
  titleSmall: {
    fontFamily: md3FontFamily.plain,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    letterSpacing: "0.1px",
  },

  // Body - Main body text
  bodyLarge: {
    fontFamily: md3FontFamily.plain,
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: "24px",
    letterSpacing: "0.5px",
  },
  bodyMedium: {
    fontFamily: md3FontFamily.plain,
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "20px",
    letterSpacing: "0.25px",
  },
  bodySmall: {
    fontFamily: md3FontFamily.plain,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: "16px",
    letterSpacing: "0.4px",
  },

  // Label - Utility text, buttons, form labels
  labelLarge: {
    fontFamily: md3FontFamily.plain,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    letterSpacing: "0.1px",
  },
  labelMedium: {
    fontFamily: md3FontFamily.plain,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: "16px",
    letterSpacing: "0.5px",
  },
  labelSmall: {
    fontFamily: md3FontFamily.plain,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: "16px",
    letterSpacing: "0.5px",
  },
};

/**
 * Generate CSS custom property definitions for typography
 */
export function generateTypographyCssVars(): Record<string, string> {
  const vars: Record<string, string> = {
    "--md3-font-brand": md3FontFamily.brand,
    "--md3-font-plain": md3FontFamily.plain,
    "--md3-font-code": md3FontFamily.code,
  };

  for (const [key, style] of Object.entries(md3TypeScale)) {
    const prefix = `--md3-typescale-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    vars[`${prefix}-font`] = style.fontFamily;
    vars[`${prefix}-size`] = style.fontSize;
    vars[`${prefix}-weight`] = String(style.fontWeight);
    vars[`${prefix}-line-height`] = style.lineHeight;
    vars[`${prefix}-tracking`] = style.letterSpacing;
  }

  return vars;
}

/**
 * Get CSS shorthand for a type style (for font property)
 */
export function getTypeStyleCss(style: MD3TypeStyle): string {
  return `${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;
}
