/**
 * Material Design 3 Motion System
 *
 * MD3 motion uses easing curves and duration tokens to create
 * consistent, expressive animations throughout the UI.
 *
 * @see https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
 */

/**
 * MD3 Easing Curves
 *
 * - Standard: Most transitions, balanced acceleration
 * - Emphasized: Large transitions, more dramatic
 * - Standard Decelerate: Elements entering the screen
 * - Standard Accelerate: Elements leaving the screen
 * - Emphasized Decelerate: Elements entering with emphasis
 * - Emphasized Accelerate: Elements leaving with emphasis
 */
export const md3Easing = {
  /** Standard easing for most transitions */
  standard: "cubic-bezier(0.2, 0.0, 0, 1.0)",

  /** Standard decelerate - for elements entering the screen */
  standardDecelerate: "cubic-bezier(0, 0, 0, 1)",

  /** Standard accelerate - for elements leaving the screen */
  standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)",

  /** Emphasized easing for important/large transitions */
  emphasized: "cubic-bezier(0.2, 0.0, 0, 1.0)",

  /** Emphasized decelerate - for elements entering with emphasis */
  emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1.0)",

  /** Emphasized accelerate - for elements leaving with emphasis */
  emphasizedAccelerate: "cubic-bezier(0.3, 0.0, 0.8, 0.15)",

  /** Legacy easing for compatibility */
  legacy: "cubic-bezier(0.4, 0.0, 0.2, 1.0)",

  /** Linear - no easing */
  linear: "linear",
} as const;

/**
 * MD3 Duration Tokens
 *
 * Short durations: Simple transitions, state changes
 * Medium durations: Component transitions
 * Long durations: Complex or dramatic transitions
 * Extra long: Full screen transitions
 */
export const md3Duration = {
  // Short durations (simple transitions)
  short1: "50ms",
  short2: "100ms",
  short3: "150ms",
  short4: "200ms",

  // Medium durations (component transitions)
  medium1: "250ms",
  medium2: "300ms",
  medium3: "350ms",
  medium4: "400ms",

  // Long durations (complex transitions)
  long1: "450ms",
  long2: "500ms",
  long3: "550ms",
  long4: "600ms",

  // Extra long (page transitions)
  extraLong1: "700ms",
  extraLong2: "800ms",
  extraLong3: "900ms",
  extraLong4: "1000ms",
} as const;

/**
 * MD3 Shape Corner Radii
 *
 * @see https://m3.material.io/styles/shape/shape-scale-tokens
 */
export const md3Shape = {
  none: "0px",
  extraSmall: "4px",
  small: "8px",
  medium: "12px",
  large: "16px",
  extraLarge: "28px",
  full: "9999px",
} as const;

export type MD3Easing = keyof typeof md3Easing;
export type MD3Duration = keyof typeof md3Duration;
export type MD3Shape = keyof typeof md3Shape;

/**
 * Generate CSS custom properties for motion
 */
export function generateMotionCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  // Easing
  for (const [key, value] of Object.entries(md3Easing)) {
    vars[`--md3-easing-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] =
      value;
  }

  // Duration
  for (const [key, value] of Object.entries(md3Duration)) {
    vars[`--md3-duration-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] =
      value;
  }

  // Shape
  for (const [key, value] of Object.entries(md3Shape)) {
    vars[`--md3-shape-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] = value;
  }

  return vars;
}

/**
 * Get transition CSS string for common MD3 patterns
 */
export function getTransition(
  properties: string[],
  duration: MD3Duration = "medium1",
  easing: MD3Easing = "standard"
): string {
  const durationValue = md3Duration[duration];
  const easingValue = md3Easing[easing];
  return properties
    .map((prop) => `${prop} ${durationValue} ${easingValue}`)
    .join(", ");
}

/**
 * State layer opacity values for interactive elements
 */
export const md3StateLayer = {
  /** No state active */
  none: 0,
  /** Hover state */
  hover: 0.08,
  /** Focus state */
  focus: 0.1,
  /** Pressed state */
  pressed: 0.1,
  /** Dragged state */
  dragged: 0.16,
} as const;

/**
 * Generate CSS for a state layer pseudo-element
 */
export function getStateLayerCss(): string {
  return `
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: currentColor;
      opacity: 0;
      transition: opacity var(--md3-duration-short2) var(--md3-easing-standard);
      pointer-events: none;
    }

    &:hover::before {
      opacity: ${md3StateLayer.hover};
    }

    &:focus-visible::before {
      opacity: ${md3StateLayer.focus};
    }

    &:active::before {
      opacity: ${md3StateLayer.pressed};
    }
  `;
}
