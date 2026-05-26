import { describe, it, expect } from 'vitest';
import { applySharpenFilter, applyUnsharpMaskFilter } from '../filters/sharpenFilter';

describe('applySharpenFilter', () => {
  it('leaves a uniform image unchanged', () => {
    // Kernel sum = (0-2+0-2+11-2+0-2+0) = 3, divided by 3 = 1 → V*1 = V
    const inputValues = new Uint8Array(9).fill(100);
    const outputValues = new Uint8Array(9);
    applySharpenFilter(inputValues, outputValues, 3, 3);
    expect(Array.from(outputValues)).toEqual(Array.from(inputValues));
  });

  it('preserves width and height (output length matches input)', () => {
    const inputValues = new Uint8Array(16).fill(128);
    const outputValues = new Uint8Array(16);
    applySharpenFilter(inputValues, outputValues, 4, 4);
    expect(outputValues.length).toBe(16);
  });

  it('applySharpenFilter: does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200, 50, 100, 150, 200, 50]);  // 3x3
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(9);
    applySharpenFilter(inputValues, outputValues, 3, 3);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});

describe('applyUnsharpMaskFilter', () => {
  it('leaves a uniform image unchanged', () => {
    // blurred = original for uniform image → sharpened = original + 0 = original
    const inputValues = new Uint8Array(9).fill(150);
    const outputValues = new Uint8Array(9);
    applyUnsharpMaskFilter(inputValues, outputValues, 3, 3);
    expect(Array.from(outputValues)).toEqual(Array.from(inputValues));
  });

  it('preserves width and height (output length matches input)', () => {
    const inputValues = new Uint8Array(16).fill(128);
    const outputValues = new Uint8Array(16);
    applyUnsharpMaskFilter(inputValues, outputValues, 4, 4);
    expect(outputValues.length).toBe(16);
  });

  it('amplifies differences between neighbouring pixels', () => {
    // A bright pixel surrounded by dark ones should get brighter
    const inputValues = new Uint8Array([
      50, 50, 50,
      50, 200, 50,
      50, 50, 50,
    ]);
    const outputValues = new Uint8Array(9);
    applyUnsharpMaskFilter(inputValues, outputValues, 3, 3);
    expect(outputValues[4]).toBeGreaterThan(200); // centre pixel boosted
  });

  it('applyUnsharpMaskFilter: does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200, 50, 100, 150, 200, 50]);  // 3x3
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(9);
    applyUnsharpMaskFilter(inputValues, outputValues, 3, 3);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
