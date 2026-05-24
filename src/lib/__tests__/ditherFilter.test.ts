import { describe, it, expect } from 'vitest';
import { applyDitherFilter } from '../filters/ditherFilter';

describe('applyDitherFilter', () => {
  it('with amount=0 and randomness=0, writes input values to output unchanged', () => {
    const inputValues = new Uint8Array([10, 20, 30, 40]);
    const outputValues = new Uint8Array(4);
    applyDitherFilter(inputValues, outputValues, 4, 1, 0, 0);
    expect(Array.from(outputValues)).toEqual([10, 20, 30, 40]);
  });

  it('applies checkerboard offset: even positions increase, odd positions decrease', () => {
    // 1×4 image, all 128, amount=10, no randomness
    const inputValues = new Uint8Array([128, 128, 128, 128]);
    const outputValues = new Uint8Array(4);
    applyDitherFilter(inputValues, outputValues, 4, 1, 10, 0);
    // (row=0, col=0): even → +10 → 138
    // (row=0, col=1): odd  → -10 → 118
    expect(outputValues[0]).toBe(138);
    expect(outputValues[1]).toBe(118);
    expect(outputValues[2]).toBe(138);
    expect(outputValues[3]).toBe(118);
  });

  it('clamps checkerboard output to 0–255', () => {
    // high-end: 245 + 20 = 265 → clamped to 255
    // low-end:  5 - 20 = -15 → clamped to 0
    const inputValues = new Uint8Array([245, 5]);
    const outputValues = new Uint8Array(2);
    applyDitherFilter(inputValues, outputValues, 2, 1, 20, 0);
    expect(outputValues[0]).toBe(255);
    expect(outputValues[1]).toBe(0);
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyDitherFilter(inputValues, outputValues, 4, 1, 5, 0);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
