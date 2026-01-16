/**
 * Material Design 3 Elevation System
 *
 * MD3 uses a combination of shadows and surface tints to create elevation.
 * This module defines:
 * - 6 elevation levels (0-5)
 * - Shadow definitions for each level
 * - Surface tint opacity for each level
 *
 * @see https://m3.material.io/styles/elevation/overview
 */

export interface MD3ElevationLevel {
  /** CSS box-shadow value */
  shadow: string;
  /** Surface tint opacity (0-1) for dark mode */
  tintOpacity: number;
  /** Elevation value in dp */
  dp: number;
}

/**
 * MD3 Elevation Levels
 *
 * Level 0: No elevation (flat surfaces)
 * Level 1: Low elevation (cards, side sheets)
 * Level 2: Medium-low (navigation drawers)
 * Level 3: Medium (dialogs, modals)
 * Level 4: Medium-high (menus)
 * Level 5: High (snackbars, FABs)
 */
export const md3Elevation: Record<number, MD3ElevationLevel> = {
  0: {
    shadow: "none",
    tintOpacity: 0,
    dp: 0,
  },
  1: {
    shadow:
      "0px 1px 2px 0px rgba(0, 0, 0, 0.30), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)",
    tintOpacity: 0.05,
    dp: 1,
  },
  2: {
    shadow:
      "0px 1px 2px 0px rgba(0, 0, 0, 0.30), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)",
    tintOpacity: 0.08,
    dp: 3,
  },
  3: {
    shadow:
      "0px 4px 8px 3px rgba(0, 0, 0, 0.15), 0px 1px 3px 0px rgba(0, 0, 0, 0.30)",
    tintOpacity: 0.11,
    dp: 6,
  },
  4: {
    shadow:
      "0px 6px 10px 4px rgba(0, 0, 0, 0.15), 0px 2px 3px 0px rgba(0, 0, 0, 0.30)",
    tintOpacity: 0.12,
    dp: 8,
  },
  5: {
    shadow:
      "0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px 0px rgba(0, 0, 0, 0.30)",
    tintOpacity: 0.14,
    dp: 12,
  },
};

/**
 * Generate CSS custom properties for elevation
 */
export function generateElevationCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [level, elevation] of Object.entries(md3Elevation)) {
    vars[`--md3-elevation-level${level}`] = elevation.shadow;
    vars[`--md3-elevation-level${level}-tint`] = String(elevation.tintOpacity);
  }

  return vars;
}

/**
 * Get elevation shadow for a specific level
 */
export function getElevationShadow(level: 0 | 1 | 2 | 3 | 4 | 5): string {
  return md3Elevation[level].shadow;
}

/**
 * Get surface tint opacity for a specific elevation level
 * Used in dark mode to overlay surfaces with primary color
 */
export function getSurfaceTintOpacity(level: 0 | 1 | 2 | 3 | 4 | 5): number {
  return md3Elevation[level].tintOpacity;
}
