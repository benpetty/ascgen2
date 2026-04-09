import type { GrayscaleImage } from '../types';

function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Applies brightness and contrast adjustments.
 * Brightness: additive offset (-200 to +200)
 * Contrast: uses Photoshop-style formula (-100 to +100)
 */
export function applyBrightnessContrastFilter(
  image: GrayscaleImage,
  brightness: number,
  contrast: number
): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  // Photoshop-style contrast factor: keeps midpoint at 128
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let index = 0; index < values.length; index++) {
    // Apply brightness first, then contrast
    const brightened = values[index] + brightness;
    const contrasted = contrastFactor * (brightened - 128) + 128;
    result[index] = clampToByte(contrasted);
  }

  return { values: result, width, height };
}
