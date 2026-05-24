import { describe, it, expect } from 'vitest';
import { applyBrightnessContrastFilter } from '../filters/brightnessContrastFilter';

describe('applyBrightnessContrastFilter', () => {
  it('leaves values unchanged when brightness and contrast are both 0', () => {
    const inputValues = new Uint8Array([0, 128, 255]);
    const outputValues = new Uint8Array(inputValues.length);
    applyBrightnessContrastFilter(inputValues, outputValues, inputValues.length, 1, 0, 0);
    expect(Array.from(outputValues)).toEqual([0, 128, 255]);
  });

  it('increases all values with positive brightness', () => {
    const inputValues = new Uint8Array([100, 100, 100]);
    const outputValues = new Uint8Array(inputValues.length);
    applyBrightnessContrastFilter(inputValues, outputValues, inputValues.length, 1, 50, 0);
    expect(outputValues[0]).toBeGreaterThan(100);
  });

  it('decreases all values with negative brightness', () => {
    const inputValues = new Uint8Array([100, 100, 100]);
    const outputValues = new Uint8Array(inputValues.length);
    applyBrightnessContrastFilter(inputValues, outputValues, inputValues.length, 1, -50, 0);
    expect(outputValues[0]).toBeLessThan(100);
  });

  it('clamps values to 0–255', () => {
    const inputValues = new Uint8Array([250]);
    const outputValues = new Uint8Array(inputValues.length);
    applyBrightnessContrastFilter(inputValues, outputValues, inputValues.length, 1, 100, 0);
    expect(outputValues[0]).toBe(255);

    const inputValues2 = new Uint8Array([10]);
    const outputValues2 = new Uint8Array(inputValues2.length);
    applyBrightnessContrastFilter(inputValues2, outputValues2, inputValues2.length, 1, -100, 0);
    expect(outputValues2[0]).toBe(0);
  });

  it('increases contrast spreading values away from midpoint', () => {
    // Values above 128 should go higher, below 128 should go lower
    const inputValues = new Uint8Array([64, 192]);
    const outputValues = new Uint8Array(inputValues.length);
    applyBrightnessContrastFilter(inputValues, outputValues, inputValues.length, 1, 0, 50);
    expect(outputValues[0]).toBeLessThan(64);
    expect(outputValues[1]).toBeGreaterThan(192);
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyBrightnessContrastFilter(inputValues, outputValues, 4, 1, 20, 30);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
