import { mapBrightnessToCharacter } from './asciiRamp';

export function renderGrayscaleToText(
  values: Uint8Array,
  width: number,
  height: number,
  ramp: string,
): string {
  const rows: string[] = new Array(height);
  for (let row = 0; row < height; row++) {
    const rowOffset = row * width;
    const chars: string[] = new Array(width);
    for (let col = 0; col < width; col++) {
      chars[col] = mapBrightnessToCharacter(values[rowOffset + col], ramp);
    }
    rows[row] = chars.join('');
  }
  return rows.length > 0 ? rows.join('\n') + '\n' : '';
}
