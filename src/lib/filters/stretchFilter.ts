export function applyStretchFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
): void {
  let minValue = 255;
  let maxValue = 0;

  for (let index = 0; index < inputValues.length; index++) {
    const value = inputValues[index];
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }

  const range = maxValue - minValue;
  if (range === 0) {
    outputValues.set(inputValues);
    return;
  }

  const scaleFactor = 255 / range;
  for (let index = 0; index < inputValues.length; index++) {
    outputValues[index] = Math.round((inputValues[index] - minValue) * scaleFactor);
  }
}
