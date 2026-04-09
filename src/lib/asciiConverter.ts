import type { ConversionSettings, AsciiGrid, AsciiCell, GrayscaleImage } from './types';
import {
  extractGrayscaleValues,
  extractColorValues,
  calculateAutoOutputHeight,
} from './imageProcessor';
import { applyStretchFilter } from './filters/stretchFilter';
import { applyBrightnessContrastFilter } from './filters/brightnessContrastFilter';
import { applyLevelsFilter } from './filters/levelsFilter';
import { applySharpenFilter, applyUnsharpMaskFilter } from './filters/sharpenFilter';
import { applyDitherFilter } from './filters/ditherFilter';
import { applyFlipHorizontalFilter, applyFlipVerticalFilter } from './filters/flipFilter';
import { mapBrightnessToCharacter, reverseRamp } from './asciiRamp';

function resolveOutputDimensions(
  image: HTMLImageElement,
  settings: ConversionSettings
): { width: number; height: number } {
  const outputWidth = Math.max(1, settings.outputWidth);

  let outputHeight: number;
  if (settings.outputHeight > 0 && !settings.maintainAspectRatio) {
    outputHeight = settings.outputHeight;
  } else {
    outputHeight = calculateAutoOutputHeight(
      image.naturalWidth,
      image.naturalHeight,
      outputWidth,
      settings.characterAspectRatio
    );
  }

  return { width: outputWidth, height: Math.max(1, outputHeight) };
}

function applyFilterPipeline(
  grayscaleImage: GrayscaleImage,
  settings: ConversionSettings
): GrayscaleImage {
  let processed = grayscaleImage;

  // 1. Stretch — normalize to full tonal range
  if (settings.applyStretch) {
    processed = applyStretchFilter(processed);
  }

  // 2. Brightness / Contrast
  if (settings.brightness !== 0 || settings.contrast !== 0) {
    processed = applyBrightnessContrastFilter(processed, settings.brightness, settings.contrast);
  }

  // 3. Levels — tonal range and gamma
  const levelsNeutral =
    settings.levelsInputMin === 0 &&
    settings.levelsInputMax === 255 &&
    settings.levelsGamma === 1.0;
  if (!levelsNeutral) {
    processed = applyLevelsFilter(
      processed,
      settings.levelsInputMin,
      settings.levelsInputMax,
      settings.levelsGamma
    );
  }

  // 4. Sharpening — only one mode active at a time
  if (settings.applyUnsharpMask) {
    processed = applyUnsharpMaskFilter(processed);
  } else if (settings.applySharpen) {
    processed = applySharpenFilter(processed);
  }

  // 5. Dither
  if (settings.ditherAmount > 0 || settings.ditherRandom > 0) {
    processed = applyDitherFilter(processed, settings.ditherAmount, settings.ditherRandom);
  }

  // 6. Flip transforms
  if (settings.flipHorizontal) {
    processed = applyFlipHorizontalFilter(processed);
  }
  if (settings.flipVertical) {
    processed = applyFlipVerticalFilter(processed);
  }

  return processed;
}

export function convertImageToAscii(
  image: HTMLImageElement,
  settings: ConversionSettings
): AsciiGrid {
  const { width: outputWidth, height: outputHeight } = resolveOutputDimensions(image, settings);

  const grayscaleImage = extractGrayscaleValues(image, outputWidth, outputHeight);
  const processedImage = applyFilterPipeline(grayscaleImage, settings);

  const colorValues =
    settings.colorMode === 'color'
      ? extractColorValues(image, outputWidth, outputHeight)
      : null;

  const effectiveRamp = settings.invertRamp
    ? reverseRamp(settings.characterRamp)
    : settings.characterRamp;

  const grid: AsciiGrid = [];

  for (let row = 0; row < outputHeight; row++) {
    const gridRow: AsciiCell[] = [];

    for (let col = 0; col < outputWidth; col++) {
      const index = row * outputWidth + col;
      const brightness = processedImage.values[index];
      const character = mapBrightnessToCharacter(brightness, effectiveRamp);

      const cell: AsciiCell = { character };

      if (colorValues) {
        cell.color = colorValues[index];
      }

      gridRow.push(cell);
    }

    grid.push(gridRow);
  }

  return grid;
}
