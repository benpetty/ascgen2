import type { GrayscaleImage } from '../types';

function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// 3×3 sharpen convolution kernel from Ascgen2 source: [0,-2,0,-2,11,-2,0,-2,0] / 3
const SHARPEN_KERNEL = [0, -2, 0, -2, 11, -2, 0, -2, 0];
const KERNEL_DIVISOR = 3;

/**
 * Enhances edges using a 3×3 convolution kernel.
 * Edge pixels clamp to nearest valid neighbor (replicate padding).
 */
export function applySharpenFilter(image: GrayscaleImage): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let sum = 0;
      let kernelIndex = 0;

      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          sum += values[sampleRow * width + sampleCol] * SHARPEN_KERNEL[kernelIndex];
          kernelIndex++;
        }
      }

      result[row * width + col] = clampToByte(sum / KERNEL_DIVISOR);
    }
  }

  return { values: result, width, height };
}

/**
 * Unsharp mask sharpening — subtracts a blurred version from the original.
 * Provides a softer, more natural sharpening than the convolution kernel.
 */
export function applyUnsharpMaskFilter(image: GrayscaleImage): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);

  // 3×3 box blur
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let blurSum = 0;
      let sampleCount = 0;

      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          blurSum += values[sampleRow * width + sampleCol];
          sampleCount++;
        }
      }

      const blurred = blurSum / sampleCount;
      const originalValue = values[row * width + col];
      // Unsharp mask: original + (original - blurred) * strength
      const sharpened = originalValue + (originalValue - blurred) * 1.5;
      result[row * width + col] = clampToByte(sharpened);
    }
  }

  return { values: result, width, height };
}
