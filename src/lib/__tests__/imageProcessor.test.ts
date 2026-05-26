import { describe, it, expect } from 'vitest';
import { calculateAutoOutputHeight, pixelsToGrayscaleInto } from '../imageProcessor';

describe('pixelsToGrayscaleInto', () => {
  it('writes ITU-R BT.601 luminance into the provided output buffer', () => {
    // Two RGBA pixels: pure white, pure black
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const output = new Uint8Array(2);
    pixelsToGrayscaleInto(rgba, output);
    expect(output[0]).toBe(255);
    expect(output[1]).toBe(0);
  });

  it('matches the ITU-R BT.601 weights for a known RGB sample', () => {
    // Pure red — 0.299 * 255 ≈ 76
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const output = new Uint8Array(1);
    pixelsToGrayscaleInto(rgba, output);
    expect(output[0]).toBe(76);
  });

  it('applies BT.601 weights for green and blue channels', () => {
    // Pure green: 0.587 * 255 ≈ 150 (Math.round(149.685))
    // Pure blue:  0.114 * 255 ≈ 29  (Math.round(29.07))
    const rgba = new Uint8ClampedArray([0, 255, 0, 255, 0, 0, 255, 255]);
    const output = new Uint8Array(2);
    pixelsToGrayscaleInto(rgba, output);
    expect(output[0]).toBe(150);
    expect(output[1]).toBe(29);
  });

  it('throws when buffer sizes do not match', () => {
    const rgba = new Uint8ClampedArray(8);  // 2 pixels
    const output = new Uint8Array(3);        // expects 3 pixels worth
    expect(() => pixelsToGrayscaleInto(rgba, output)).toThrow(/does not match/);
  });
});

describe('calculateAutoOutputHeight', () => {
  it('calculates height preserving aspect ratio with character ratio applied', () => {
    // 100×50 image at width 100, character ratio 0.5 → 50 * 0.5 = 25
    expect(calculateAutoOutputHeight(100, 50, 100, 0.5)).toBe(25);
  });

  it('handles a square image with default character ratio', () => {
    // 100×100 at width 80, ratio 0.5 → 80 * 1.0 * 0.5 = 40
    expect(calculateAutoOutputHeight(100, 100, 80, 0.5)).toBe(40);
  });

  it('returns at least 1 for very small dimensions', () => {
    expect(calculateAutoOutputHeight(1000, 1, 10, 0.5)).toBe(1);
  });

  it('handles portrait images correctly', () => {
    // 50×100 at width 50, ratio 0.5 → 50 * 2.0 * 0.5 = 50
    expect(calculateAutoOutputHeight(50, 100, 50, 0.5)).toBe(50);
  });
});
