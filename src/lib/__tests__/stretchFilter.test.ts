import { describe, it, expect } from 'vitest';
import { applyStretchFilter } from '../filters/stretchFilter';

describe('applyStretchFilter', () => {
  it('stretches a narrow range to fill 0–255', () => {
    const inputValues = new Uint8Array([100, 150, 200]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(outputValues[0]).toBe(0);
    expect(outputValues[2]).toBe(255);
  });

  it('copies input to output when all pixels are the same value', () => {
    const inputValues = new Uint8Array([128, 128, 128]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(Array.from(outputValues)).toEqual([128, 128, 128]);
  });

  it('does not change an image already spanning 0–255', () => {
    const inputValues = new Uint8Array([0, 128, 255]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(outputValues[0]).toBe(0);
    expect(outputValues[1]).toBe(128);
    expect(outputValues[2]).toBe(255);
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
