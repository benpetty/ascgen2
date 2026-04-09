import type { GrayscaleImage } from '../types';

function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Adjusts tonal levels of the image.
 * inputMin/inputMax: define the input range that maps to 0–255
 * gamma: midtone adjustment (< 1.0 darkens, 1.0 = neutral, > 1.0 lightens)
 */
export function applyLevelsFilter(
  image: GrayscaleImage,
  inputMin: number,
  inputMax: number,
  gamma: number
): GrayscaleImage {
  const isNeutral = inputMin === 0 && inputMax === 255 && gamma === 1.0;
  if (isNeutral) return image;

  const { values, width, height } = image;
  const result = new Uint8Array(values.length);
  const inputRange = Math.max(1, inputMax - inputMin);
  const gammaExponent = 1.0 / Math.max(0.01, gamma);

  for (let index = 0; index < values.length; index++) {
    // Map input range to 0–1, clamping out-of-range values
    const normalized = Math.max(0, Math.min(1, (values[index] - inputMin) / inputRange));
    // Apply gamma correction
    const gammaAdjusted = Math.pow(normalized, gammaExponent);
    result[index] = clampToByte(gammaAdjusted * 255);
  }

  return { values: result, width, height };
}
