import type { GrayscaleImage } from '../types';

/**
 * Normalizes pixel values to fill the full 0–255 range.
 * Maps the darkest pixel to 0 and the brightest to 255.
 */
export function applyStretchFilter(image: GrayscaleImage): GrayscaleImage {
  const { values, width, height } = image;

  let minValue = 255;
  let maxValue = 0;

  for (let index = 0; index < values.length; index++) {
    if (values[index] < minValue) minValue = values[index];
    if (values[index] > maxValue) maxValue = values[index];
  }

  const range = maxValue - minValue;
  if (range === 0) return image; // All pixels same value — nothing to stretch

  const stretched = new Uint8Array(values.length);
  const scaleFactor = 255 / range;

  for (let index = 0; index < values.length; index++) {
    stretched[index] = Math.round((values[index] - minValue) * scaleFactor);
  }

  return { values: stretched, width, height };
}
