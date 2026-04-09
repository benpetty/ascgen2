import { describe, it, expect } from 'vitest';
import { applyBrightnessContrastFilter } from '../filters/brightnessContrastFilter';
import type { GrayscaleImage } from '../types';

function makeImage(values: number[]): GrayscaleImage {
  return { values: new Uint8Array(values), width: values.length, height: 1 };
}

describe('applyBrightnessContrastFilter', () => {
  it('leaves values unchanged when brightness and contrast are both 0', () => {
    const image = makeImage([0, 128, 255]);
    const result = applyBrightnessContrastFilter(image, 0, 0);
    expect(Array.from(result.values)).toEqual([0, 128, 255]);
  });

  it('increases all values with positive brightness', () => {
    const image = makeImage([100, 100, 100]);
    const result = applyBrightnessContrastFilter(image, 50, 0);
    expect(result.values[0]).toBeGreaterThan(100);
  });

  it('decreases all values with negative brightness', () => {
    const image = makeImage([100, 100, 100]);
    const result = applyBrightnessContrastFilter(image, -50, 0);
    expect(result.values[0]).toBeLessThan(100);
  });

  it('clamps values to 0–255', () => {
    const image = makeImage([250]);
    const result = applyBrightnessContrastFilter(image, 100, 0);
    expect(result.values[0]).toBe(255);

    const image2 = makeImage([10]);
    const result2 = applyBrightnessContrastFilter(image2, -100, 0);
    expect(result2.values[0]).toBe(0);
  });

  it('increases contrast spreading values away from midpoint', () => {
    // Values above 128 should go higher, below 128 should go lower
    const image = makeImage([64, 192]);
    const result = applyBrightnessContrastFilter(image, 0, 50);
    expect(result.values[0]).toBeLessThan(64);
    expect(result.values[1]).toBeGreaterThan(192);
  });
});
