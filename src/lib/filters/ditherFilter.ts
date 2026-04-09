import type { GrayscaleImage } from '../types';

function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Adds controlled noise to create dithering effects.
 * amount: checkerboard pattern strength (0–25)
 * randomness: random noise strength (0–20)
 */
export function applyDitherFilter(
  image: GrayscaleImage,
  amount: number,
  randomness: number
): GrayscaleImage {
  if (amount === 0 && randomness === 0) return image;

  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      let value = values[index];

      // Checkerboard pattern: alternating positive/negative offset
      if (amount > 0) {
        const checkerOffset = (row + col) % 2 === 0 ? amount : -amount;
        value += checkerOffset;
      }

      // Random noise component
      if (randomness > 0) {
        const noise = (Math.random() * 2 - 1) * randomness;
        value += noise;
      }

      result[index] = clampToByte(value);
    }
  }

  return { values: result, width, height };
}
