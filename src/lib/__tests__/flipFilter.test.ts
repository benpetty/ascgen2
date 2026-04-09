import { describe, it, expect } from 'vitest';
import { applyFlipHorizontalFilter, applyFlipVerticalFilter } from '../filters/flipFilter';
import type { GrayscaleImage } from '../types';

// 2×2 image:
// [10, 20]
// [30, 40]
function make2x2(): GrayscaleImage {
  return { values: new Uint8Array([10, 20, 30, 40]), width: 2, height: 2 };
}

describe('applyFlipHorizontalFilter', () => {
  it('mirrors each row left-to-right', () => {
    const result = applyFlipHorizontalFilter(make2x2());
    // Row 0: [20, 10], Row 1: [40, 30]
    expect(Array.from(result.values)).toEqual([20, 10, 40, 30]);
  });

  it('applying twice restores the original', () => {
    const image = make2x2();
    const result = applyFlipHorizontalFilter(applyFlipHorizontalFilter(image));
    expect(Array.from(result.values)).toEqual(Array.from(image.values));
  });

  it('preserves width and height', () => {
    const result = applyFlipHorizontalFilter(make2x2());
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});

describe('applyFlipVerticalFilter', () => {
  it('reverses the row order', () => {
    const result = applyFlipVerticalFilter(make2x2());
    // Row 0 becomes row 1: [30, 40, 10, 20]
    expect(Array.from(result.values)).toEqual([30, 40, 10, 20]);
  });

  it('applying twice restores the original', () => {
    const image = make2x2();
    const result = applyFlipVerticalFilter(applyFlipVerticalFilter(image));
    expect(Array.from(result.values)).toEqual(Array.from(image.values));
  });

  it('preserves width and height', () => {
    const result = applyFlipVerticalFilter(make2x2());
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});
