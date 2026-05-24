import { clampToByte } from './filterUtils';

export function applyDitherFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
  amount: number,
  randomness: number,
): void {
  for (let row = 0; row < height; row++) {
    const rowOffset = row * width;
    for (let col = 0; col < width; col++) {
      const index = rowOffset + col;
      let value = inputValues[index];
      if (amount > 0) {
        const checkerOffset = (row + col) % 2 === 0 ? amount : -amount;
        value += checkerOffset;
      }
      if (randomness > 0) {
        const noise = (Math.random() * 2 - 1) * randomness;
        value += noise;
      }
      outputValues[index] = clampToByte(value);
    }
  }
}
