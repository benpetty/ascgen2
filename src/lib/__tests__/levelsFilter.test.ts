import { describe, it, expect } from 'vitest';
import { applyLevelsFilter } from '../filters/levelsFilter';
import type { GrayscaleImage } from '../types';

function makeImage(values: number[]): GrayscaleImage {
  return { values: new Uint8Array(values), width: values.length, height: 1 };
}

describe('applyLevelsFilter', () => {
  it('returns the same image reference when settings are neutral', () => {
    const image = makeImage([0, 128, 255]);
    const result = applyLevelsFilter(image, 0, 255, 1.0);
    expect(result).toBe(image);
  });

  it('maps inputMin to 0 and inputMax to 255', () => {
    const image = makeImage([100, 200]);
    const result = applyLevelsFilter(image, 100, 200, 1.0);
    expect(result.values[0]).toBe(0);
    expect(result.values[1]).toBe(255);
  });

  it('clamps values outside the input range', () => {
    const image = makeImage([0, 255]);
    const result = applyLevelsFilter(image, 50, 200, 1.0);
    expect(result.values[0]).toBe(0);   // below inputMin → clamps to 0
    expect(result.values[1]).toBe(255); // above inputMax → clamps to 255
  });

  it('gamma > 1 lightens midtones', () => {
    const image = makeImage([128]);
    const neutral = applyLevelsFilter(image, 0, 255, 1.0);
    const lightened = applyLevelsFilter(image, 0, 255, 2.0);
    expect(lightened.values[0]).toBeGreaterThan(neutral.values[0]);
  });

  it('gamma < 1 darkens midtones', () => {
    const image = makeImage([128]);
    const neutral = applyLevelsFilter(image, 0, 255, 1.0);
    const darkened = applyLevelsFilter(image, 0, 255, 0.5);
    expect(darkened.values[0]).toBeLessThan(neutral.values[0]);
  });
});
