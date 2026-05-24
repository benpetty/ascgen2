export function applyFlipHorizontalFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    const rowOffset = row * width;
    for (let col = 0; col < width; col++) {
      outputValues[rowOffset + col] = inputValues[rowOffset + (width - 1 - col)];
    }
  }
}

export function applyFlipVerticalFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    const sourceRowOffset = (height - 1 - row) * width;
    const targetRowOffset = row * width;
    for (let col = 0; col < width; col++) {
      outputValues[targetRowOffset + col] = inputValues[sourceRowOffset + col];
    }
  }
}
