import { describe, it, expect } from 'vitest';
import { applyFilterPipeline } from '../asciiConverter';
import { DEFAULT_RAMP } from '../asciiRamp';
import type { ConversionSettings } from '../types';

const NEUTRAL_SETTINGS: ConversionSettings = {
  outputWidth: 8,
  outputHeight: 4,
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

describe('filter pipeline (direct applyFilterPipeline tests)', () => {
  it('all-neutral pipeline returns input buffer reference (no work, no swap)', () => {
    const width = 4;
    const height = 2;
    const inputBuffer = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const scratchBuffer = new Uint8Array(width * height);
    const result = applyFilterPipeline(inputBuffer, scratchBuffer, width, height, NEUTRAL_SETTINGS);
    expect(result).toBe(inputBuffer);  // same reference, no filters ran
    expect(Array.from(result)).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('brightness +50 raises every output byte by 50 (within clamp)', () => {
    const width = 4;
    const height = 1;
    const inputBuffer = new Uint8Array([10, 50, 100, 150]);
    const scratchBuffer = new Uint8Array(width * height);
    const result = applyFilterPipeline(inputBuffer, scratchBuffer, width, height, {
      ...NEUTRAL_SETTINGS,
      brightness: 50,
    });
    // brightnessContrast: each pixel + 50 (contrast factor is 1.0 when contrast=0)
    expect(Array.from(result)).toEqual([60, 100, 150, 200]);
  });
});

describe('pipeline allocation regression gate', () => {
  it('does not construct any Uint8Array during 100 pipeline runs on pre-allocated buffers', () => {
    const width = 80;
    const height = 40;

    // Wrapping globalThis to override Uint8Array constructor for allocation tracking.
    // The cast is unavoidable for this test pattern; isolated to one location.
    const globalScope = globalThis as unknown as { Uint8Array: typeof Uint8Array };
    const OriginalUint8Array = globalScope.Uint8Array;

    const inputBuffer = new OriginalUint8Array(width * height);
    const scratchBuffer = new OriginalUint8Array(width * height);
    inputBuffer.fill(128);

    let constructionCount = 0;
    class TrackingUint8Array extends OriginalUint8Array {
      constructor(...args: ConstructorParameters<typeof Uint8Array>) {
        super(...(args as ConstructorParameters<typeof Uint8Array>));
        constructionCount++;
      }
    }
    globalScope.Uint8Array = TrackingUint8Array as typeof Uint8Array;

    const activeSettings: ConversionSettings = {
      ...NEUTRAL_SETTINGS,
      applyStretch: true,
      brightness: 10,
      contrast: 5,
      ditherAmount: 3,
      ditherRandom: 2,
      flipHorizontal: true,
    };

    try {
      for (let frame = 0; frame < 100; frame++) {
        applyFilterPipeline(inputBuffer, scratchBuffer, width, height, activeSettings);
      }
    } finally {
      globalScope.Uint8Array = OriginalUint8Array;
    }

    expect(constructionCount).toBe(0);
  });
});
