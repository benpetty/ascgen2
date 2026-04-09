// Default ramp ordered from lightest (least ink) to darkest (most ink) — suits a dark background
export const DEFAULT_RAMP =
  '         ..........,,,,,,:,:::::::iiiiiiiii;;;;;;;;rrrrrrr7777777XXXXXXXXXXXSSSSSSS2222222aaaaaaZaZZZZZZZZZ888888800000000BBBBBBBBWWWWWWWWW@@@@@@@MMMMMMM';

export interface RampPreset {
  label: string;
  ramp: string;
}

export const RAMP_PRESETS: RampPreset[] = [
  { label: 'Standard (Ascgen2)', ramp: DEFAULT_RAMP }, // light→dark, suits dark backgrounds
  { label: 'Detailed', ramp: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ' },
  { label: 'Simple', ramp: '@#S%?*+;:,. ' },
  { label: 'Minimal', ramp: '@:. ' },
  { label: 'Numbers', ramp: '98765432 ' },
  { label: 'Block Elements', ramp: '█▓▒░ ' },
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
