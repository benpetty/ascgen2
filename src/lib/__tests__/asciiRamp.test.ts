import { describe, it, expect } from 'vitest';
import { mapBrightnessToCharacter, reverseRamp } from '../asciiRamp';

describe('mapBrightnessToCharacter', () => {
  const ramp = '@#. '; // 4 chars: dark → light

  it('maps brightness 0 to the first character', () => {
    expect(mapBrightnessToCharacter(0, ramp)).toBe('@');
  });

  it('maps brightness 255 to the last character', () => {
    expect(mapBrightnessToCharacter(255, ramp)).toBe(' ');
  });

  it('maps a midpoint brightness to the middle of the ramp', () => {
    // 128/255 * 3 ≈ 1.506 → rounds to 2 → '.'
    expect(mapBrightnessToCharacter(128, ramp)).toBe('.');
  });

  it('returns a space when given an empty ramp', () => {
    expect(mapBrightnessToCharacter(128, '')).toBe(' ');
  });

  it('clamps brightness values below 0', () => {
    expect(mapBrightnessToCharacter(-50, ramp)).toBe('@');
  });

  it('clamps brightness values above 255', () => {
    expect(mapBrightnessToCharacter(999, ramp)).toBe(' ');
  });
});

describe('reverseRamp', () => {
  it('reverses the ramp string', () => {
    expect(reverseRamp('@#. ')).toBe(' .#@');
  });

  it('handles a single character ramp', () => {
    expect(reverseRamp('@')).toBe('@');
  });

  it('handles an empty ramp', () => {
    expect(reverseRamp('')).toBe('');
  });
});
