import type { AsciiGrid } from '../types';

function colorToHex(red: number, green: number, blue: number): string {
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

function escapeHtmlChar(char: string): string {
  if (char === '&') return '&amp;';
  if (char === '<') return '&lt;';
  if (char === '>') return '&gt;';
  if (char === ' ') return '&nbsp;';
  return char;
}

export function asciiGridToHtml(
  grid: AsciiGrid,
  backgroundColor: string = '#000000',
  foregroundColor: string = '#33ff44',
  fontFamily: string = 'Courier New, monospace',
  fontSize: number = 12
): string {
  const rows = grid.map(row => {
    const cells = row.map(cell => {
      const escapedChar = escapeHtmlChar(cell.character);
      if (cell.color) {
        const { red, green, blue } = cell.color;
        const colorHex = colorToHex(red, green, blue);
        return `<span style="color:${colorHex}">${escapedChar}</span>`;
      }
      return escapedChar;
    }).join('');
    return cells;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ASCII Art</title>
<style>
  body {
    background-color: ${backgroundColor};
    color: ${foregroundColor};
    font-family: ${fontFamily};
    font-size: ${fontSize}px;
    line-height: 1.2;
    margin: 0;
    padding: 16px;
  }
  pre {
    margin: 0;
    white-space: pre;
  }
</style>
</head>
<body>
<pre>${rows}</pre>
</body>
</html>`;
}

export function downloadHtmlFile(
  grid: AsciiGrid,
  baseFilename: string = 'ascii-art',
  backgroundColor: string = '#000000',
  foregroundColor: string = '#33ff44'
): void {
  const html = asciiGridToHtml(grid, backgroundColor, foregroundColor);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${baseFilename}.html`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
