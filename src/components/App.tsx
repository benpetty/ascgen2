import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ConversionSettings, AsciiGrid } from '../lib/types';
import { DEFAULT_RAMP } from '../lib/asciiRamp';
import { loadImageFromFile } from '../lib/imageProcessor';
import { convertImageToAscii } from '../lib/asciiConverter';
import { SettingsPanel } from './SettingsPanel';
import { AsciiPreview } from './AsciiPreview';

export const DEFAULT_SETTINGS: ConversionSettings = {
  outputWidth: 120,
  outputHeight: 0,
  maintainAspectRatio: true,
  characterAspectRatio: 0.5,
  characterRamp: DEFAULT_RAMP,
  invertRamp: false,
  applyStretch: true,
  brightness: 0,
  contrast: 0,
  levelsInputMin: 0,
  levelsInputMax: 255,
  levelsGamma: 1.0,
  applySharpen: false,
  applyUnsharpMask: false,
  ditherAmount: 0,
  ditherRandom: 0,
  flipHorizontal: false,
  flipVertical: false,
  colorMode: 'white-on-black',
};

export function App() {
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [settings, setSettings] = useState<ConversionSettings>(DEFAULT_SETTINGS);
  const [asciiGrid, setAsciiGrid] = useState<AsciiGrid | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced conversion to avoid thrashing during slider drags
  const scheduleConversion = useCallback(
    (image: HTMLImageElement, currentSettings: ConversionSettings) => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
      }
      setIsProcessing(true);

      conversionTimerRef.current = setTimeout(() => {
        try {
          const grid = convertImageToAscii(image, currentSettings);
          setAsciiGrid(grid);
          setErrorMessage(null);
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Conversion failed'
          );
        } finally {
          setIsProcessing(false);
        }
      }, 80);
    },
    []
  );

  useEffect(() => {
    if (loadedImage) {
      scheduleConversion(loadedImage, settings);
    }
    return () => {
      if (conversionTimerRef.current) {
        clearTimeout(conversionTimerRef.current);
      }
    };
  }, [loadedImage, settings, scheduleConversion]);

  const handleFileSelected = useCallback(async (file: File) => {
    setErrorMessage(null);
    try {
      const image = await loadImageFromFile(file);
      setImageFileName(file.name);
      setLoadedImage(image);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load image'
      );
    }
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileSelected(file);
        // Reset so the same file can be loaded again
        event.target.value = '';
      }
    },
    [handleFileSelected]
  );

  return (
    <div className="app-root">
      {/* Top header bar */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-prompt">$</span>
          <span className="header-title">ascgen2</span>
          <span className="header-subtitle">// ascii generator v2 — web edition</span>
        </div>
        <div className="header-right">
          {imageFileName && (
            <span className="header-filename">{imageFileName}</span>
          )}
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            [LOAD IMAGE]
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="app-body">
        <aside className="sidebar">
          <SettingsPanel
            settings={settings}
            asciiGrid={asciiGrid}
            imageFileName={imageFileName}
            onSettingsChange={setSettings}
          />
        </aside>

        <main className="preview-main">
          <AsciiPreview
            grid={asciiGrid}
            settings={settings}
            isProcessing={isProcessing}
            errorMessage={errorMessage}
            onFileDrop={handleFileSelected}
          />
        </main>
      </div>
    </div>
  );
}
