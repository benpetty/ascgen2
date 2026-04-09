import { describe, it, expect } from 'vitest';
import { applySharpenFilter, applyUnsharpMaskFilter } from '../filters/sharpenFilter';
import type { GrayscaleImage } from '../types';

function makeUniformImage(value: number, width = 3, height = 3): GrayscaleImage {
  return {
    values: new Uint8Array(width * height).fill(value),
    width,
    height,
  };
}

describe('applySharpenFilter', () => {
  it('leaves a uniform image unchanged', () => {
    // Kernel sum = (0-2+0-2+11-2+0-2+0) = 3, divided by 3 = 1 → V*1 = V
    const image = makeUniformImage(100);
    const result = applySharpenFilter(image);
    expect(Array.from(result.values)).toEqual(Array.from(image.values));
  });

  it('preserves width and height', () => {
    const image = makeUniformImage(128, 4, 4);
    const result = applySharpenFilter(image);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });
});

describe('applyUnsharpMaskFilter', () => {
  it('leaves a uniform image unchanged', () => {
    // blurred = original for uniform image → sharpened = original + 0 = original
    const image = makeUniformImage(150);
    const result = applyUnsharpMaskFilter(image);
    expect(Array.from(result.values)).toEqual(Array.from(image.values));
  });

  it('preserves width and height', () => {
    const image = makeUniformImage(128, 4, 4);
    const result = applyUnsharpMaskFilter(image);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('amplifies differences between neighbouring pixels', () => {
    // A bright pixel surrounded by dark ones should get brighter
    const values = new Uint8Array([
      50, 50, 50,
      50, 200, 50,
      50, 50, 50,
    ]);
    const image: GrayscaleImage = { values, width: 3, height: 3 };
    const result = applyUnsharpMaskFilter(image);
    expect(result.values[4]).toBeGreaterThan(200); // centre pixel boosted
  });
});
