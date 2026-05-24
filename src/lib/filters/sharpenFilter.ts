import { clampToByte } from './filterUtils';

// 3×3 sharpen convolution kernel from Ascgen2 source: [0,-2,0,-2,11,-2,0,-2,0] / 3
const SHARPEN_KERNEL = [0, -2, 0, -2, 11, -2, 0, -2, 0];
const KERNEL_DIVISOR = 3;
// 3×3 kernel; replicate padding means every position has exactly 9 taps
const BOX_BLUR_TAPS = 9;

export function applySharpenFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    const rowOffset = row * width;
    for (let col = 0; col < width; col++) {
      let sum = 0;
      let kernelIndex = 0;
      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          sum += inputValues[sampleRow * width + sampleCol] * SHARPEN_KERNEL[kernelIndex];
          kernelIndex++;
        }
      }
      outputValues[rowOffset + col] = clampToByte(sum / KERNEL_DIVISOR);
    }
  }
}

export function applyUnsharpMaskFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    const rowOffset = row * width;
    for (let col = 0; col < width; col++) {
      let blurSum = 0;
      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          blurSum += inputValues[sampleRow * width + sampleCol];
        }
      }
      const blurred = blurSum / BOX_BLUR_TAPS;
      const originalValue = inputValues[rowOffset + col];
      // Unsharp mask: original + (original - blurred) * strength
      const sharpened = originalValue + (originalValue - blurred) * 1.5;
      outputValues[rowOffset + col] = clampToByte(sharpened);
    }
  }
}
