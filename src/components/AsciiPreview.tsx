import React, { useCallback, useRef, useState } from 'react';
import type { AsciiGrid, ConversionSettings } from '../lib/types';

interface AsciiPreviewProps {
  grid: AsciiGrid | null;
  settings: ConversionSettings;
  isProcessing: boolean;
  errorMessage: string | null;
  onFileDrop: (file: File) => void;
}

export function AsciiPreview({
  grid,
  settings,
  isProcessing,
  errorMessage,
  onFileDrop,
}: AsciiPreviewProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFontSize, setPreviewFontSize] = useState(10);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  const previewTextColor =
    settings.colorMode === 'black-on-white' ? '#111111' : '#33ff44';
  const previewBgColor =
    settings.colorMode === 'black-on-white' ? '#f0f0f0' : '#0a0a0a';

  const renderAsciiContent = () => {
    if (!grid) return null;

    return grid.map((row, rowIndex) => (
      <span key={rowIndex} className="ascii-row">
        {row.map((cell, colIndex) => {
          if (cell.color) {
            const { red, green, blue } = cell.color;
            return (
              <span
                key={colIndex}
                style={{ color: `rgb(${red},${green},${blue})` }}
              >
                {cell.character}
              </span>
            );
          }
          return cell.character;
        })}
        {'\n'}
      </span>
    ));
  };

  return (
    <div className="preview-container">
      {/* Preview toolbar */}
      <div className="preview-toolbar">
        <span className="preview-toolbar-label">PREVIEW</span>
        {grid && (
          <span className="preview-dimensions">
            {grid[0]?.length ?? 0}×{grid.length} chars
          </span>
        )}
        <div className="preview-zoom-controls">
          <span className="preview-toolbar-label">zoom:</span>
          <button
            className="zoom-btn"
            onClick={() => setPreviewFontSize(currentSize => Math.max(4, currentSize - 1))}
          >
            [-]
          </button>
          <span className="zoom-value">{previewFontSize}px</span>
          <button
            className="zoom-btn"
            onClick={() => setPreviewFontSize(currentSize => Math.min(24, currentSize + 1))}
          >
            [+]
          </button>
        </div>
      </div>

      {/* Drop zone / preview area */}
      <div
        ref={dropZoneRef}
        className={`preview-area ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ backgroundColor: previewBgColor }}
      >
        {isProcessing && (
          <div className="status-overlay">
            <span className="status-text blink">processing...</span>
          </div>
        )}

        {errorMessage && !isProcessing && (
          <div className="status-overlay">
            <span className="status-error">ERROR: {errorMessage}</span>
          </div>
        )}

        {!grid && !isProcessing && !errorMessage && (
          <div className="drop-instructions">
            <pre className="drop-art">{DROP_ZONE_ART}</pre>
            <p className="drop-hint">drag & drop an image here</p>
            <p className="drop-hint-sub">or use [LOAD IMAGE] above</p>
            <p className="drop-hint-sub">supports: jpg · png · gif · webp · bmp</p>
          </div>
        )}

        {grid && !isProcessing && (
          <pre
            className="ascii-output"
            style={{
              fontSize: `${previewFontSize}px`,
              color: previewTextColor,
            }}
          >
            {renderAsciiContent()}
          </pre>
        )}
      </div>
    </div>
  );
}

const DROP_ZONE_ART = `
▄▖▄▖▄▖▄▖▄▖▖ ▖▄▖
▌▌▚ ▌ ▌ ▙▖▛▖▌▄▌
▛▌▄▌▙▖▙▌▙▖▌▝▌▙▖
`.trim();
