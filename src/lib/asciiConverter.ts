import type { ConversionSettings, AsciiGrid, AsciiCell } from './types';
import {
  extractGrayscaleValues,
  extractColorValues,
  calculateAutoOutputHeight,
  getSourceDimensions,
} from './imageProcessor';
import { applyStretchFilter } from './filters/stretchFilter';
import { applyBrightnessContrastFilter } from './filters/brightnessContrastFilter';
import { applyLevelsFilter } from './filters/levelsFilter';
import { applySharpenFilter, applyUnsharpMaskFilter } from './filters/sharpenFilter';
import { applyDitherFilter } from './filters/ditherFilter';
import { applyFlipHorizontalFilter, applyFlipVerticalFilter } from './filters/flipFilter';
import { mapBrightnessToCharacter, reverseRamp } from './asciiRamp';

function resolveOutputDimensions(
  source: CanvasImageSource,
  settings: ConversionSettings,
): { width: number; height: number } {
  const outputWidth = Math.max(1, settings.outputWidth);
  let outputHeight: number;
  if (settings.outputHeight > 0 && !settings.maintainAspectRatio) {
    outputHeight = settings.outputHeight;
  } else {
    const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
    outputHeight = calculateAutoOutputHeight(
      sourceWidth,
      sourceHeight,
      outputWidth,
      settings.characterAspectRatio,
    );
  }
  return { width: outputWidth, height: Math.max(1, outputHeight) };
}

export function applyFilterPipeline(
  inputBuffer: Uint8Array,
  scratchBuffer: Uint8Array,
  width: number,
  height: number,
  settings: ConversionSettings,
): Uint8Array {
  let read = inputBuffer;
  let write = scratchBuffer;

  // 1. Stretch
  if (settings.applyStretch) {
    applyStretchFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  // 2. Brightness / Contrast
  if (settings.brightness !== 0 || settings.contrast !== 0) {
    applyBrightnessContrastFilter(read, write, width, height, settings.brightness, settings.contrast);
    [read, write] = [write, read];
  }

  // 3. Levels
  const levelsNeutral =
    settings.levelsInputMin === 0 && settings.levelsInputMax === 255 && settings.levelsGamma === 1.0;
  if (!levelsNeutral) {
    applyLevelsFilter(read, write, width, height, settings.levelsInputMin, settings.levelsInputMax, settings.levelsGamma);
    [read, write] = [write, read];
  }

  // 4. Sharpening (mutually exclusive)
  if (settings.applyUnsharpMask) {
    applyUnsharpMaskFilter(read, write, width, height);
    [read, write] = [write, read];
  } else if (settings.applySharpen) {
    applySharpenFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  // 5. Dither
  if (settings.ditherAmount > 0 || settings.ditherRandom > 0) {
    applyDitherFilter(read, write, width, height, settings.ditherAmount, settings.ditherRandom);
    [read, write] = [write, read];
  }

  // 6. Flips
  if (settings.flipHorizontal) {
    applyFlipHorizontalFilter(read, write, width, height);
    [read, write] = [write, read];
  }
  if (settings.flipVertical) {
    applyFlipVerticalFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  return read;
}

export function convertImageToAscii(
  source: CanvasImageSource,
  settings: ConversionSettings,
): AsciiGrid {
  const { width: outputWidth, height: outputHeight } = resolveOutputDimensions(source, settings);

  const grayscaleImage = extractGrayscaleValues(source, outputWidth, outputHeight);
  const scratchBuffer = new Uint8Array(outputWidth * outputHeight);
  const finalBuffer = applyFilterPipeline(
    grayscaleImage.values,
    scratchBuffer,
    outputWidth,
    outputHeight,
    settings,
  );

  const colorValues =
    settings.colorMode === 'color'
      ? extractColorValues(source, outputWidth, outputHeight)
      : null;

  const effectiveRamp = settings.invertRamp
    ? reverseRamp(settings.characterRamp)
    : settings.characterRamp;

  const grid: AsciiGrid = [];
  for (let row = 0; row < outputHeight; row++) {
    const gridRow: AsciiCell[] = [];
    for (let col = 0; col < outputWidth; col++) {
      const index = row * outputWidth + col;
      const character = mapBrightnessToCharacter(finalBuffer[index], effectiveRamp);
      const cell: AsciiCell = { character };
      if (colorValues) cell.color = colorValues[index];
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }
  return grid;
}
