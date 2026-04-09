import { describe, it, expect } from 'vitest';
import { applyStretchFilter } from '../filters/stretchFilter';
import type { GrayscaleImage } from '../types';

function makeImage(values: number[]): GrayscaleImage {
  return { values: new Uint8Array(values), width: values.length, height: 1 };
}

describe('applyStretchFilter', () => {
  it('stretches a narrow range to fill 0–255', () => {
    const image = makeImage([100, 150, 200]);
    const result = applyStretchFilter(image);
    expect(result.values[0]).toBe(0);
    expect(result.values[2]).toBe(255);
  });

  it('returns the original image when all pixels are the same value', () => {
    const image = makeImage([128, 128, 128]);
    const result = applyStretchFilter(image);
    expect(result).toBe(image); // same reference — no-op
  });

  it('does not change an image already spanning 0–255', () => {
    const image = makeImage([0, 128, 255]);
    const result = applyStretchFilter(image);
    expect(result.values[0]).toBe(0);
    expect(result.values[1]).toBe(128);
    expect(result.values[2]).toBe(255);
  });

  it('preserves width and height', () => {
    const image = { values: new Uint8Array([50, 200]), width: 2, height: 1 };
    const result = applyStretchFilter(image);
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
  });
});
