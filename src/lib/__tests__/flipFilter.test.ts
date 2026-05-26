import { describe, it, expect } from 'vitest';
import { applyFlipHorizontalFilter, applyFlipVerticalFilter } from '../filters/flipFilter';

// 2×2 image:
// [10, 20]
// [30, 40]

describe('applyFlipHorizontalFilter', () => {
  it('mirrors each row left-to-right', () => {
    const inputValues = new Uint8Array([10, 20, 30, 40]);
    const outputValues = new Uint8Array(4);
    applyFlipHorizontalFilter(inputValues, outputValues, 2, 2);
    // Row 0: [20, 10], Row 1: [40, 30]
    expect(Array.from(outputValues)).toEqual([20, 10, 40, 30]);
  });

  it('applying twice restores the original', () => {
    const inputValues = new Uint8Array([10, 20, 30, 40]);
    const intermediateValues = new Uint8Array(4);
    applyFlipHorizontalFilter(inputValues, intermediateValues, 2, 2);
    const outputValues = new Uint8Array(4);
    applyFlipHorizontalFilter(intermediateValues, outputValues, 2, 2);
    expect(Array.from(outputValues)).toEqual(Array.from(inputValues));
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([1, 2, 3, 4]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyFlipHorizontalFilter(inputValues, outputValues, 4, 1);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});

describe('applyFlipVerticalFilter', () => {
  it('reverses the row order', () => {
    const inputValues = new Uint8Array([10, 20, 30, 40]);
    const outputValues = new Uint8Array(4);
    applyFlipVerticalFilter(inputValues, outputValues, 2, 2);
    // Row 0 becomes row 1: [30, 40, 10, 20]
    expect(Array.from(outputValues)).toEqual([30, 40, 10, 20]);
  });

  it('applying twice restores the original', () => {
    const inputValues = new Uint8Array([10, 20, 30, 40]);
    const intermediateValues = new Uint8Array(4);
    applyFlipVerticalFilter(inputValues, intermediateValues, 2, 2);
    const outputValues = new Uint8Array(4);
    applyFlipVerticalFilter(intermediateValues, outputValues, 2, 2);
    expect(Array.from(outputValues)).toEqual(Array.from(inputValues));
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([1, 2, 3, 4]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyFlipVerticalFilter(inputValues, outputValues, 2, 2);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
