/**
 * Material Design 3 Design Token System
 *
 * This module exports all MD3 design tokens for use in the application.
 *
 * @example
 * import { md3Colors, md3TypeScale, md3Elevation, md3Motion } from '$lib/md3';
 */

// Color tokens
export {
  md3Colors,
  generateMD3Scheme,
  type MD3ColorTokens,
  type MD3ColorScheme,
} from "./color-tokens.js";

// Typography
export {
  md3TypeScale,
  md3FontFamily,
  generateTypographyCssVars,
  getTypeStyleCss,
  type MD3TypeStyle,
  type MD3TypeScale,
} from "./typography.js";

// Elevation
export {
  md3Elevation,
  generateElevationCssVars,
  getElevationShadow,
  getSurfaceTintOpacity,
  type MD3ElevationLevel,
} from "./elevation.js";

// Motion
export {
  md3Easing,
  md3Duration,
  md3Shape,
  md3StateLayer,
  generateMotionCssVars,
  getTransition,
  getStateLayerCss,
  type MD3Easing,
  type MD3Duration,
  type MD3Shape,
} from "./motion.js";
