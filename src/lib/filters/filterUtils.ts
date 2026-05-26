/**
 * Clamps a value to the 0-255 byte range with rounding.
 * Shared utility used by every filter that produces a Uint8Array byte.
 */
export function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
