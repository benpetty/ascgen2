import type { GrayscaleImage } from '../types';

export function applyFlipHorizontalFilter(image: GrayscaleImage): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      result[row * width + col] = values[row * width + (width - 1 - col)];
    }
  }

  return { values: result, width, height };
}

export function applyFlipVerticalFilter(image: GrayscaleImage): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  for (let row = 0; row < height; row++) {
    const sourceRow = height - 1 - row;
    for (let col = 0; col < width; col++) {
      result[row * width + col] = values[sourceRow * width + col];
    }
  }

  return { values: result, width, height };
}
