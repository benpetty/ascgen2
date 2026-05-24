import type { GrayscaleImage, ColorPixel } from './types';

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

function createResizedCanvasContext(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return context;
}

export function pixelsToGrayscaleInto(
  rgbaData: Uint8ClampedArray,
  outputValues: Uint8Array,
): void {
  if (rgbaData.length !== outputValues.length * 4) {
    throw new Error(
      `pixelsToGrayscaleInto: rgbaData length ${rgbaData.length} does not match outputValues.length * 4 (${outputValues.length * 4})`,
    );
  }
  const pixelCount = outputValues.length;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const dataOffset = pixelIndex * 4;
    const red = rgbaData[dataOffset];
    const green = rgbaData[dataOffset + 1];
    const blue = rgbaData[dataOffset + 2];
    // Standard luminance formula (ITU-R BT.601)
    outputValues[pixelIndex] = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  }
}

export function extractGrayscaleValues(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): GrayscaleImage {
  const context = createResizedCanvasContext(image, targetWidth, targetHeight);
  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
  const grayscaleValues = new Uint8Array(targetWidth * targetHeight);
  pixelsToGrayscaleInto(data, grayscaleValues);
  return { values: grayscaleValues, width: targetWidth, height: targetHeight };
}

export function extractColorValues(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): ColorPixel[] {
  const context = createResizedCanvasContext(image, targetWidth, targetHeight);
  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);

  const pixelCount = targetWidth * targetHeight;
  const colorValues: ColorPixel[] = new Array(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const dataOffset = pixelIndex * 4;
    colorValues[pixelIndex] = {
      red: data[dataOffset],
      green: data[dataOffset + 1],
      blue: data[dataOffset + 2],
    };
  }

  return colorValues;
}

export function calculateAutoOutputHeight(
  imageWidth: number,
  imageHeight: number,
  outputWidth: number,
  characterAspectRatio: number
): number {
  return Math.max(1, Math.round(outputWidth * (imageHeight / imageWidth) * characterAspectRatio));
}
