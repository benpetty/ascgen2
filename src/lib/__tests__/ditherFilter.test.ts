import { describe, it, expect } from 'vitest';
import { applyDitherFilter } from '../filters/ditherFilter';
import type { GrayscaleImage } from '../types';

function makeImage(values: number[], width = values.length, height = 1): GrayscaleImage {
  return { values: new Uint8Array(values), width, height };
}

describe('applyDitherFilter', () => {
  it('returns the same image reference when amount and randomness are both 0', () => {
    const image = makeImage([100, 150, 200]);
    expect(applyDitherFilter(image, 0, 0)).toBe(image);
  });

  it('applies checkerboard offset: even positions increase, odd positions decrease', () => {
    // 1×4 image, all 128, amount=10, no randomness
    const image = makeImage([128, 128, 128, 128]);
    const result = applyDitherFilter(image, 10, 0);
    // (row=0, col=0): even → +10 → 138
    // (row=0, col=1): odd  → -10 → 118
    expect(result.values[0]).toBe(138);
    expect(result.values[1]).toBe(118);
    expect(result.values[2]).toBe(138);
    expect(result.values[3]).toBe(118);
  });

  it('clamps checkerboard output to 0–255', () => {
    const image = makeImage([5, 250]);
    const result = applyDitherFilter(image, 20, 0);
    expect(result.values[0]).toBe(25);  // 5 + 20
    expect(result.values[1]).toBe(230); // 250 - 20
  });

  it('preserves width and height', () => {
    const image = makeImage([128, 128], 2, 1);
    const result = applyDitherFilter(image, 10, 0);
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
  });
});
