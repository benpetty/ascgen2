import { describe, it, expect } from 'vitest';
import { calculateAutoOutputHeight } from '../imageProcessor';

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
