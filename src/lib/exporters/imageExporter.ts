import type { AsciiGrid } from '../types';

export interface ImageExportOptions {
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
  foregroundColor: string;
  lineHeightMultiplier: number;
}

const DEFAULT_IMAGE_EXPORT_OPTIONS: ImageExportOptions = {
  fontFamily: 'Courier New, monospace',
  fontSize: 14,
  backgroundColor: '#000000',
  foregroundColor: '#33ff44',
  lineHeightMultiplier: 1.2,
};

export function renderAsciiGridToCanvas(
  grid: AsciiGrid,
  options: Partial<ImageExportOptions> = {}
): HTMLCanvasElement {
  const opts = { ...DEFAULT_IMAGE_EXPORT_OPTIONS, ...options };
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // Measure character dimensions using a reference character
  context.font = `${opts.fontSize}px ${opts.fontFamily}`;
  const charMetrics = context.measureText('M');
  const charWidth = charMetrics.width;
  const charHeight = opts.fontSize * opts.lineHeightMultiplier;

  const gridWidth = grid[0]?.length ?? 0;
  const gridHeight = grid.length;

  canvas.width = Math.ceil(gridWidth * charWidth);
  canvas.height = Math.ceil(gridHeight * charHeight);

  // Fill background
  context.fillStyle = opts.backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each character
  context.font = `${opts.fontSize}px ${opts.fontFamily}`;
  context.textBaseline = 'top';

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];
    const yPosition = rowIndex * charHeight;

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex];
      const xPosition = colIndex * charWidth;

      if (cell.color) {
        const { red, green, blue } = cell.color;
        context.fillStyle = `rgb(${red},${green},${blue})`;
      } else {
        context.fillStyle = opts.foregroundColor;
      }

      context.fillText(cell.character, xPosition, yPosition);
    }
  }

  return canvas;
}

export function downloadImageFile(
  grid: AsciiGrid,
  baseFilename: string = 'ascii-art',
  options: Partial<ImageExportOptions> = {}
): void {
  const canvas = renderAsciiGridToCanvas(grid, options);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${baseFilename}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
