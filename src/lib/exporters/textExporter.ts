import type { AsciiGrid } from '../types';

export function asciiGridToText(grid: AsciiGrid): string {
  return grid.map(row => row.map(cell => cell.character).join('')).join('\n');
}

export function downloadTextFile(grid: AsciiGrid, baseFilename: string = 'ascii-art'): void {
  const text = asciiGridToText(grid);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${baseFilename}.txt`);
}

export function copyTextToClipboard(grid: AsciiGrid): Promise<void> {
  const text = asciiGridToText(grid);
  return navigator.clipboard.writeText(text);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
