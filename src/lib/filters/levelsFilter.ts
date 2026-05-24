import { clampToByte } from './filterUtils';

export function applyLevelsFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
  inputMin: number,
  inputMax: number,
  gamma: number,
): void {
  const inputRange = Math.max(1, inputMax - inputMin);
  const gammaExponent = 1.0 / Math.max(0.01, gamma);
  for (let index = 0; index < inputValues.length; index++) {
    const normalized = Math.max(0, Math.min(1, (inputValues[index] - inputMin) / inputRange));
    const gammaAdjusted = Math.pow(normalized, gammaExponent);
    outputValues[index] = clampToByte(gammaAdjusted * 255);
  }
}
