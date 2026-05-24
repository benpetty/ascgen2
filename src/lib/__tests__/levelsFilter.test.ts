import { describe, it, expect } from 'vitest';
import { applyLevelsFilter } from '../filters/levelsFilter';

describe('applyLevelsFilter', () => {
  it('produces a numerically-equivalent passthrough for neutral params', () => {
    // The pipeline orchestrator gates the call externally for the (0, 255, 1.0) neutral case,
    // so this path is normally unreachable. This test verifies the math still degenerates
    // to identity if the filter is somehow called directly with neutral params.
    const inputValues = new Uint8Array([0, 128, 255]);
    const outputValues = new Uint8Array(inputValues.length);
    applyLevelsFilter(inputValues, outputValues, inputValues.length, 1, 0, 255, 1.0);
    expect(Array.from(outputValues)).toEqual([0, 128, 255]);
  });

  it('maps inputMin to 0 and inputMax to 255', () => {
    const inputValues = new Uint8Array([100, 200]);
    const outputValues = new Uint8Array(inputValues.length);
    applyLevelsFilter(inputValues, outputValues, inputValues.length, 1, 100, 200, 1.0);
    expect(outputValues[0]).toBe(0);
    expect(outputValues[1]).toBe(255);
  });

  it('clamps values outside the input range', () => {
    const inputValues = new Uint8Array([0, 255]);
    const outputValues = new Uint8Array(inputValues.length);
    applyLevelsFilter(inputValues, outputValues, inputValues.length, 1, 50, 200, 1.0);
    expect(outputValues[0]).toBe(0);   // below inputMin → clamps to 0
    expect(outputValues[1]).toBe(255); // above inputMax → clamps to 255
  });

  it('gamma > 1 lightens midtones', () => {
    const inputValues = new Uint8Array([128]);
    const neutralOutput = new Uint8Array(1);
    const lightenedOutput = new Uint8Array(1);
    applyLevelsFilter(inputValues, neutralOutput, 1, 1, 0, 255, 1.0);
    applyLevelsFilter(inputValues, lightenedOutput, 1, 1, 0, 255, 2.0);
    expect(lightenedOutput[0]).toBeGreaterThan(neutralOutput[0]);
  });

  it('gamma < 1 darkens midtones', () => {
    const inputValues = new Uint8Array([128]);
    const neutralOutput = new Uint8Array(1);
    const darkenedOutput = new Uint8Array(1);
    applyLevelsFilter(inputValues, neutralOutput, 1, 1, 0, 255, 1.0);
    applyLevelsFilter(inputValues, darkenedOutput, 1, 1, 0, 255, 0.5);
    expect(darkenedOutput[0]).toBeLessThan(neutralOutput[0]);
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyLevelsFilter(inputValues, outputValues, 4, 1, 50, 200, 1.2);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
