import { bench, describe } from 'vitest';
import { applyFilterPipeline } from '../asciiConverter';
import { DEFAULT_RAMP } from '../asciiRamp';
import type { ConversionSettings } from '../types';

const BASE_SETTINGS: ConversionSettings = {
  outputWidth: 80,
  outputHeight: 40,
  maintainAspectRatio: false,
  characterAspectRatio: 0.5,
  characterRamp: DEFAULT_RAMP,
  invertRamp: false,
  applyStretch: false,
  brightness: 0,
  contrast: 0,
  levelsInputMin: 0,
  levelsInputMax: 255,
  levelsGamma: 1.0,
  applySharpen: false,
  applyUnsharpMask: false,
  ditherAmount: 0,
  ditherRandom: 0,
  flipHorizontal: false,
  flipVertical: false,
  colorMode: 'white-on-black',
};

const width = 80;
const height = 40;

function makeBuffers() {
  const inputBuffer = new Uint8Array(width * height);
  const scratchBuffer = new Uint8Array(width * height);
  for (let index = 0; index < inputBuffer.length; index++) {
    inputBuffer[index] = (index * 37) & 0xff;
  }
  return { inputBuffer, scratchBuffer };
}

describe('filter pipeline at 80x40 (live-mode grid)', () => {
  bench('no filters enabled (baseline)', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, BASE_SETTINGS);
  });

  bench('stretch + brightness/contrast', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, {
      ...BASE_SETTINGS,
      applyStretch: true,
      brightness: 10,
      contrast: 15,
    });
  });

  bench('all filters enabled', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, {
      ...BASE_SETTINGS,
      applyStretch: true,
      brightness: 10,
      contrast: 15,
      levelsInputMin: 10,
      levelsInputMax: 240,
      levelsGamma: 1.2,
      applySharpen: true,
      ditherAmount: 3,
      ditherRandom: 2,
      flipHorizontal: true,
    });
  });
});
