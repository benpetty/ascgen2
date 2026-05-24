function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function applyBrightnessContrastFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
  brightness: number,
  contrast: number,
): void {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let index = 0; index < inputValues.length; index++) {
    const brightened = inputValues[index] + brightness;
    const contrasted = contrastFactor * (brightened - 128) + 128;
    outputValues[index] = clampToByte(contrasted);
  }
}
