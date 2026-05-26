import { describe, it, expect } from 'vitest';
import { renderGrayscaleToText } from '../liveAsciiRenderer';
import { mapBrightnessToCharacter } from '../asciiRamp';

const SIMPLE_RAMP = ' .-=+*#%@'; // 9 chars

describe('renderGrayscaleToText', () => {
  it('maps brightness=0 to the first ramp character', () => {
    const values = new Uint8Array([0]);
    const result = renderGrayscaleToText(values, 1, 1, SIMPLE_RAMP);
    expect(result).toBe(' \n');
  });

  it('maps brightness=255 to the last ramp character', () => {
    const values = new Uint8Array([255]);
    const result = renderGrayscaleToText(values, 1, 1, SIMPLE_RAMP);
    expect(result).toBe('@\n');
  });

  it('emits one newline per row', () => {
    const values = new Uint8Array([0, 0, 0, 0]);
    const result = renderGrayscaleToText(values, 2, 2, SIMPLE_RAMP);
    expect(result.split('\n').length - 1).toBe(2);
  });

  it('places newlines at row boundaries (width=4, height=2)', () => {
    const values = new Uint8Array([0, 255, 0, 255, 255, 0, 255, 0]);
    const result = renderGrayscaleToText(values, 4, 2, SIMPLE_RAMP);
    expect(result).toBe(' @ @\n@ @ \n');
  });

  it('output length is width*height + height (one newline per row)', () => {
    const width = 8;
    const height = 3;
    const values = new Uint8Array(width * height);
    const result = renderGrayscaleToText(values, width, height, SIMPLE_RAMP);
    expect(result.length).toBe(width * height + height);
  });

  it('returns an empty string for zero-dimension input', () => {
    const result = renderGrayscaleToText(new Uint8Array([]), 0, 0, SIMPLE_RAMP);
    expect(result).toBe('');
  });
});

describe('renderGrayscaleToText parity with mapBrightnessToCharacter', () => {
  it('produces the same character for every brightness value', () => {
    const ramp = '0123456789'; // distinct chars per ramp index
    for (let brightness = 0; brightness <= 255; brightness++) {
      const rendererOutput = renderGrayscaleToText(new Uint8Array([brightness]), 1, 1, ramp);
      const expected = mapBrightnessToCharacter(brightness, ramp) + '\n';
      expect(rendererOutput).toBe(expected);
    }
  });
});
