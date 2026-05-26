// Default ramp ordered from lightest (least ink) to darkest (most ink) — suits a dark background
export const DEFAULT_RAMP =
  '         ..........,,,,,,:,:::::::iiiiiiiii;;;;;;;;rrrrrrr7777777XXXXXXXXXXXSSSSSSS2222222aaaaaaZaZZZZZZZZZ888888800000000BBBBBBBBWWWWWWWWW@@@@@@@MMMMMMM';

export interface RampPreset {
  label: string;
  ramp: string;
}

// All ramps are ordered light→dark (space/least-ink first, densest character last)
// so they render correctly on a dark background. Brightness 0 maps to the first
// character (no ink), brightness 255 maps to the last (most ink). Use `invertRamp`
// in settings to flip for black-on-white rendering.
export const RAMP_PRESETS: RampPreset[] = [
  { label: 'Standard (Ascgen2)', ramp: DEFAULT_RAMP },
  { label: 'Detailed', ramp: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$' },
  { label: 'Simple', ramp: ' .,:;+*?%S#@' },
  { label: 'Minimal', ramp: ' .:@' },
  { label: 'Numbers', ramp: ' 23456789' },
  { label: 'Block Elements', ramp: ' ░▒▓█' },
];

export function mapBrightnessToCharacter(brightness: number, ramp: string): string {
  if (ramp.length === 0) return ' ';
  const clampedBrightness = Math.max(0, Math.min(255, brightness));
  const index = Math.round((clampedBrightness / 255) * (ramp.length - 1));
  return ramp[index] ?? ' ';
}

export function reverseRamp(ramp: string): string {
  return ramp.split('').reverse().join('');
}
