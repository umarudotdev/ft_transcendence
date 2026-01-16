/**
 * Material Design 3 Color Token System
 *
 * Generates a complete MD3 color scheme from a seed color using the HCT color space.
 * This implementation provides all 40+ color roles needed for a full MD3 theme.
 *
 * Seed color: #6750A4 (MD3 default purple)
 */

// HCT (Hue, Chroma, Tone) color utilities
// These functions implement the MD3 color algorithm

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
}

// Convert sRGB to linear RGB
function linearize(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

// Convert linear RGB to sRGB
function delinearize(value: number): number {
  const delinearized =
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(delinearized * 255);
}

// RGB to XYZ conversion
function rgbToXyz(
  r: number,
  g: number,
  b: number
): { x: number; y: number; z: number } {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  return {
    x: 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb,
    y: 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb,
    z: 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb,
  };
}

// XYZ to RGB conversion
function xyzToRgb(
  x: number,
  y: number,
  z: number
): { r: number; g: number; b: number } {
  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return {
    r: delinearize(Math.max(0, Math.min(1, lr))),
    g: delinearize(Math.max(0, Math.min(1, lg))),
    b: delinearize(Math.max(0, Math.min(1, lb))),
  };
}

// XYZ to LAB conversion
function xyzToLab(
  x: number,
  y: number,
  z: number
): { l: number; a: number; b: number } {
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const fx =
    x / xn > 0.008856 ? (x / xn) ** (1 / 3) : (903.3 * (x / xn) + 16) / 116;
  const fy =
    y / yn > 0.008856 ? (y / yn) ** (1 / 3) : (903.3 * (y / yn) + 16) / 116;
  const fz =
    z / zn > 0.008856 ? (z / zn) ** (1 / 3) : (903.3 * (z / zn) + 16) / 116;

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// LAB to XYZ conversion
function labToXyz(
  l: number,
  a: number,
  b: number
): { x: number; y: number; z: number } {
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const x = fx ** 3 > 0.008856 ? fx ** 3 : (116 * fx - 16) / 903.3;
  const y = l > 7.9996 ? fy ** 3 : l / 903.3;
  const z = fz ** 3 > 0.008856 ? fz ** 3 : (116 * fz - 16) / 903.3;

  return { x: x * xn, y: y * yn, z: z * zn };
}

// Get hue from LAB
function labToHue(a: number, b: number): number {
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return hue >= 0 ? hue : hue + 360;
}

// Get chroma from LAB
function labToChroma(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

// Convert hex to HCT (Hue, Chroma, Tone)
function hexToHct(hex: string): { h: number; c: number; t: number } {
  const rgb = hexToRgb(hex);
  const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
  const lab = xyzToLab(xyz.x, xyz.y, xyz.z);

  return {
    h: labToHue(lab.a, lab.b),
    c: labToChroma(lab.a, lab.b),
    t: lab.l, // Tone is approximately L* in LAB
  };
}

// Convert HCT to hex
function hctToHex(h: number, c: number, t: number): string {
  // Clamp tone
  const tone = Math.max(0, Math.min(100, t));

  // Convert hue and chroma to a/b
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const xyz = labToXyz(tone, a, b);
  const rgb = xyzToRgb(xyz.x, xyz.y, xyz.z);

  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// Generate a tonal palette (13 tones from 0-100)
function generateTonalPalette(
  hue: number,
  chroma: number
): Record<number, string> {
  const tones = [
    0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95,
    96, 98, 99, 100,
  ];
  const palette: Record<number, string> = {};

  for (const tone of tones) {
    // Reduce chroma at extreme tones for better appearance
    const adjustedChroma = tone <= 10 || tone >= 90 ? chroma * 0.5 : chroma;
    palette[tone] = hctToHex(hue, adjustedChroma, tone);
  }

  return palette;
}

// Convert hex to OKLCH CSS string
function hexToOklch(hex: string): string {
  const rgb = hexToRgb(hex);
  const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);

  // XYZ to OKLAB (simplified)
  const l = 0.2104542553 * xyz.x + 0.793617785 * xyz.y - 0.0040720468 * xyz.z;
  const m = 1.9779984951 * xyz.x - 2.428592205 * xyz.y + 0.4505937099 * xyz.z;
  const s = 0.0259040371 * xyz.x + 0.7827717662 * xyz.y - 0.808675766 * xyz.z;

  const lCubeRoot = Math.cbrt(Math.max(0, l));
  const mCubeRoot = Math.cbrt(Math.max(0, m));
  const sCubeRoot = Math.cbrt(Math.max(0, s));

  const L =
    0.2104542553 * lCubeRoot +
    0.793617785 * mCubeRoot -
    0.0040720468 * sCubeRoot;
  const A =
    1.9779984951 * lCubeRoot -
    2.428592205 * mCubeRoot +
    0.4505937099 * sCubeRoot;
  const B =
    0.0259040371 * lCubeRoot +
    0.7827717662 * mCubeRoot -
    0.808675766 * sCubeRoot;

  const C = Math.sqrt(A * A + B * B);
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  const hue = H < 0 ? H + 360 : H;

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${hue.toFixed(2)})`;
}

export interface MD3ColorTokens {
  // Primary
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  // Secondary
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  // Tertiary
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  // Error
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  // Surface
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceDim: string;
  surfaceBright: string;
  // Outline
  outline: string;
  outlineVariant: string;
  // Inverse
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  // Shadow & Scrim
  shadow: string;
  scrim: string;
  // Background (legacy)
  background: string;
  onBackground: string;
}

export interface MD3ColorScheme {
  light: MD3ColorTokens;
  dark: MD3ColorTokens;
}

/**
 * Generate a complete MD3 color scheme from a seed color
 */
export function generateMD3Scheme(seedHex: string): MD3ColorScheme {
  const seed = hexToHct(seedHex);

  // Generate tonal palettes
  const primary = generateTonalPalette(seed.h, Math.max(seed.c, 48));
  const secondary = generateTonalPalette(seed.h, 16);
  const tertiary = generateTonalPalette((seed.h + 60) % 360, 24);
  const error = generateTonalPalette(25, 84); // Red hue
  const neutral = generateTonalPalette(seed.h, 4);
  const neutralVariant = generateTonalPalette(seed.h, 8);

  const light: MD3ColorTokens = {
    // Primary
    primary: hexToOklch(primary[40]),
    onPrimary: hexToOklch(primary[100]),
    primaryContainer: hexToOklch(primary[90]),
    onPrimaryContainer: hexToOklch(primary[10]),
    // Secondary
    secondary: hexToOklch(secondary[40]),
    onSecondary: hexToOklch(secondary[100]),
    secondaryContainer: hexToOklch(secondary[90]),
    onSecondaryContainer: hexToOklch(secondary[10]),
    // Tertiary
    tertiary: hexToOklch(tertiary[40]),
    onTertiary: hexToOklch(tertiary[100]),
    tertiaryContainer: hexToOklch(tertiary[90]),
    onTertiaryContainer: hexToOklch(tertiary[10]),
    // Error
    error: hexToOklch(error[40]),
    onError: hexToOklch(error[100]),
    errorContainer: hexToOklch(error[90]),
    onErrorContainer: hexToOklch(error[10]),
    // Surface
    surface: hexToOklch(neutral[98]),
    onSurface: hexToOklch(neutral[10]),
    surfaceVariant: hexToOklch(neutralVariant[90]),
    onSurfaceVariant: hexToOklch(neutralVariant[30]),
    surfaceContainerLowest: hexToOklch(neutral[100]),
    surfaceContainerLow: hexToOklch(neutral[96]),
    surfaceContainer: hexToOklch(neutral[94]),
    surfaceContainerHigh: hexToOklch(neutral[92]),
    surfaceContainerHighest: hexToOklch(neutral[90]),
    surfaceDim: hexToOklch(neutral[87]),
    surfaceBright: hexToOklch(neutral[98]),
    // Outline
    outline: hexToOklch(neutralVariant[50]),
    outlineVariant: hexToOklch(neutralVariant[80]),
    // Inverse
    inverseSurface: hexToOklch(neutral[20]),
    inverseOnSurface: hexToOklch(neutral[95]),
    inversePrimary: hexToOklch(primary[80]),
    // Shadow & Scrim
    shadow: hexToOklch("#000000"),
    scrim: hexToOklch("#000000"),
    // Background
    background: hexToOklch(neutral[98]),
    onBackground: hexToOklch(neutral[10]),
  };

  const dark: MD3ColorTokens = {
    // Primary
    primary: hexToOklch(primary[80]),
    onPrimary: hexToOklch(primary[20]),
    primaryContainer: hexToOklch(primary[30]),
    onPrimaryContainer: hexToOklch(primary[90]),
    // Secondary
    secondary: hexToOklch(secondary[80]),
    onSecondary: hexToOklch(secondary[20]),
    secondaryContainer: hexToOklch(secondary[30]),
    onSecondaryContainer: hexToOklch(secondary[90]),
    // Tertiary
    tertiary: hexToOklch(tertiary[80]),
    onTertiary: hexToOklch(tertiary[20]),
    tertiaryContainer: hexToOklch(tertiary[30]),
    onTertiaryContainer: hexToOklch(tertiary[90]),
    // Error
    error: hexToOklch(error[80]),
    onError: hexToOklch(error[20]),
    errorContainer: hexToOklch(error[30]),
    onErrorContainer: hexToOklch(error[90]),
    // Surface
    surface: hexToOklch(neutral[6]),
    onSurface: hexToOklch(neutral[90]),
    surfaceVariant: hexToOklch(neutralVariant[30]),
    onSurfaceVariant: hexToOklch(neutralVariant[80]),
    surfaceContainerLowest: hexToOklch(neutral[4]),
    surfaceContainerLow: hexToOklch(neutral[10]),
    surfaceContainer: hexToOklch(neutral[12]),
    surfaceContainerHigh: hexToOklch(neutral[17]),
    surfaceContainerHighest: hexToOklch(neutral[22]),
    surfaceDim: hexToOklch(neutral[6]),
    surfaceBright: hexToOklch(neutral[24]),
    // Outline
    outline: hexToOklch(neutralVariant[60]),
    outlineVariant: hexToOklch(neutralVariant[30]),
    // Inverse
    inverseSurface: hexToOklch(neutral[90]),
    inverseOnSurface: hexToOklch(neutral[20]),
    inversePrimary: hexToOklch(primary[40]),
    // Shadow & Scrim
    shadow: hexToOklch("#000000"),
    scrim: hexToOklch("#000000"),
    // Background
    background: hexToOklch(neutral[6]),
    onBackground: hexToOklch(neutral[90]),
  };

  return { light, dark };
}

// Default MD3 color scheme using seed #6750A4
export const md3Colors = generateMD3Scheme("#6750A4");
