export interface ConversionSettings {
  // Output dimensions
  outputWidth: number;
  outputHeight: number; // 0 = auto-calculate from aspect ratio
  maintainAspectRatio: boolean;
  characterAspectRatio: number; // charWidth / charHeight (typically ~0.5 for monospace)

  // Character ramp (ordered dark → light)
  characterRamp: string;
  invertRamp: boolean;

  // Filters
  applyStretch: boolean;
  brightness: number; // -200 to 200
  contrast: number;   // -100 to 100

  // Levels
  levelsInputMin: number;  // 0–255
  levelsInputMax: number;  // 0–255
  levelsGamma: number;     // 0.1–10.0 (1.0 = no adjustment)

  // Effects
  applySharpen: boolean;
  applyUnsharpMask: boolean;
  ditherAmount: number; // 0–25
  ditherRandom: number; // 0–20

  // Transforms
  flipHorizontal: boolean;
  flipVertical: boolean;

  // Color output
  colorMode: 'white-on-black' | 'black-on-white' | 'color';
}

export interface GrayscaleImage {
  values: Uint8Array;
  width: number;
  height: number;
}

export interface ColorPixel {
  red: number;
  green: number;
  blue: number;
}

export interface AsciiCell {
  character: string;
  color?: ColorPixel;
}

export type AsciiGrid = AsciiCell[][];
