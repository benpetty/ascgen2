import React, { useCallback } from 'react';
import type { ConversionSettings, AsciiGrid } from '../lib/types';
import { RAMP_PRESETS } from '../lib/asciiRamp';
import { SettingsSection } from './controls/SettingsSection';
import { TerminalSlider } from './controls/TerminalSlider';
import { TerminalCheckbox } from './controls/TerminalCheckbox';
import { TerminalNumberInput } from './controls/TerminalNumberInput';
import { downloadTextFile, copyTextToClipboard } from '../lib/exporters/textExporter';
import { downloadHtmlFile } from '../lib/exporters/htmlExporter';
import { downloadImageFile } from '../lib/exporters/imageExporter';

interface SettingsPanelProps {
  settings: ConversionSettings;
  asciiGrid: AsciiGrid | null;
  imageFileName: string;
  onSettingsChange: (settings: ConversionSettings) => void;
}

export function SettingsPanel({
  settings,
  asciiGrid,
  imageFileName,
  onSettingsChange,
}: SettingsPanelProps) {
  const baseFilename = imageFileName
    ? imageFileName.replace(/\.[^/.]+$/, '')
    : 'ascii-art';

  function updateSetting<Key extends keyof ConversionSettings>(
    key: Key,
    value: ConversionSettings[Key]
  ) {
    onSettingsChange({ ...settings, [key]: value });
  }

  const handleRampPresetChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const preset = RAMP_PRESETS.find(p => p.label === event.target.value);
      if (preset) {
        onSettingsChange({ ...settings, characterRamp: preset.ramp });
      }
    },
    [settings, onSettingsChange]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!asciiGrid) return;
    try {
      await copyTextToClipboard(asciiGrid);
    } catch {
      // Clipboard write failed (permissions or insecure context)
      alert('Clipboard write failed. Try using a different browser or HTTPS.');
    }
  }, [asciiGrid]);

  const foregroundColor =
    settings.colorMode === 'black-on-white' ? '#000000' : '#33ff44';
  const backgroundColor =
    settings.colorMode === 'black-on-white' ? '#ffffff' : '#000000';

  const currentPresetLabel =
    RAMP_PRESETS.find(p => p.ramp === settings.characterRamp)?.label ?? 'Custom';

  return (
    <div className="settings-panel">
      {/* OUTPUT SIZE */}
      <SettingsSection title="OUTPUT SIZE">
        <TerminalNumberInput
          label="Width (chars)"
          value={settings.outputWidth}
          min={10}
          max={500}
          onChange={(value) => updateSetting('outputWidth', value)}
        />
        <TerminalCheckbox
          label="Auto height (aspect ratio)"
          checked={settings.maintainAspectRatio}
          onChange={(checked) => updateSetting('maintainAspectRatio', checked)}
        />
        {!settings.maintainAspectRatio && (
          <TerminalNumberInput
            label="Height (chars)"
            value={settings.outputHeight}
            min={1}
            max={500}
            onChange={(value) => updateSetting('outputHeight', value)}
          />
        )}
        <div className="control-row">
          <label className="control-label">Char aspect ratio</label>
          <input
            type="number"
            className="terminal-input"
            value={settings.characterAspectRatio}
            min={0.1}
            max={2.0}
            step={0.05}
            onChange={(event) => {
              const parsed = parseFloat(event.target.value);
              if (!isNaN(parsed) && parsed > 0) {
                updateSetting('characterAspectRatio', parsed);
              }
            }}
          />
        </div>
      </SettingsSection>

      {/* CHARACTER SET */}
      <SettingsSection title="CHARACTER SET">
        <div className="control-row">
          <label className="control-label">Preset</label>
          <select
            className="terminal-select"
            value={currentPresetLabel}
            onChange={handleRampPresetChange}
          >
            {RAMP_PRESETS.map(preset => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
            {currentPresetLabel === 'Custom' && (
              <option value="Custom">Custom</option>
            )}
          </select>
        </div>
        <div className="control-row">
          <label className="control-label">Ramp (dark→light)</label>
          <input
            type="text"
            className="terminal-input ramp-input"
            value={settings.characterRamp}
            onChange={(event) => updateSetting('characterRamp', event.target.value)}
            spellCheck={false}
          />
        </div>
        <TerminalCheckbox
          label="Invert ramp"
          checked={settings.invertRamp}
          onChange={(checked) => updateSetting('invertRamp', checked)}
        />
      </SettingsSection>

      {/* ADJUSTMENTS */}
      <SettingsSection title="ADJUSTMENTS">
        <TerminalCheckbox
          label="Stretch (normalize range)"
          checked={settings.applyStretch}
          onChange={(checked) => updateSetting('applyStretch', checked)}
        />
        <TerminalSlider
          label="Brightness"
          value={settings.brightness}
          min={-200}
          max={200}
          onChange={(value) => updateSetting('brightness', value)}
        />
        <TerminalSlider
          label="Contrast"
          value={settings.contrast}
          min={-100}
          max={100}
          onChange={(value) => updateSetting('contrast', value)}
        />
      </SettingsSection>

      {/* LEVELS */}
      <SettingsSection title="LEVELS" defaultOpen={false}>
        <TerminalSlider
          label="Input min"
          value={settings.levelsInputMin}
          min={0}
          max={255}
          onChange={(value) => {
            const newMin = Math.min(value, settings.levelsInputMax - 1);
            updateSetting('levelsInputMin', newMin);
          }}
        />
        <TerminalSlider
          label="Input max"
          value={settings.levelsInputMax}
          min={0}
          max={255}
          onChange={(value) => {
            const newMax = Math.max(value, settings.levelsInputMin + 1);
            updateSetting('levelsInputMax', newMax);
          }}
        />
        <TerminalSlider
          label="Gamma"
          value={settings.levelsGamma}
          min={0.1}
          max={10.0}
          step={0.1}
          onChange={(value) => updateSetting('levelsGamma', value)}
        />
      </SettingsSection>

      {/* EFFECTS */}
      <SettingsSection title="EFFECTS" defaultOpen={false}>
        <TerminalCheckbox
          label="Sharpen"
          checked={settings.applySharpen}
          disabled={settings.applyUnsharpMask}
          onChange={(checked) => updateSetting('applySharpen', checked)}
        />
        <TerminalCheckbox
          label="Unsharp mask"
          checked={settings.applyUnsharpMask}
          disabled={settings.applySharpen}
          onChange={(checked) => updateSetting('applyUnsharpMask', checked)}
        />
        <TerminalSlider
          label="Dither amount"
          value={settings.ditherAmount}
          min={0}
          max={25}
          onChange={(value) => updateSetting('ditherAmount', value)}
        />
        <TerminalSlider
          label="Dither random"
          value={settings.ditherRandom}
          min={0}
          max={20}
          onChange={(value) => updateSetting('ditherRandom', value)}
        />
      </SettingsSection>

      {/* TRANSFORM */}
      <SettingsSection title="TRANSFORM" defaultOpen={false}>
        <TerminalCheckbox
          label="Flip horizontal"
          checked={settings.flipHorizontal}
          onChange={(checked) => updateSetting('flipHorizontal', checked)}
        />
        <TerminalCheckbox
          label="Flip vertical"
          checked={settings.flipVertical}
          onChange={(checked) => updateSetting('flipVertical', checked)}
        />
      </SettingsSection>

      {/* COLOR MODE */}
      <SettingsSection title="COLOR MODE">
        <div className="radio-group">
          {(['white-on-black', 'black-on-white', 'color'] as const).map((mode) => (
            <label key={mode} className="control-checkbox">
              <span className="checkbox-box">
                {settings.colorMode === mode ? '(*)' : '( )'}
              </span>
              <input
                type="radio"
                name="colorMode"
                value={mode}
                checked={settings.colorMode === mode}
                onChange={() => updateSetting('colorMode', mode)}
                style={{ display: 'none' }}
              />
              <span className="checkbox-label">{mode}</span>
            </label>
          ))}
        </div>
      </SettingsSection>

      {/* EXPORT */}
      <SettingsSection title="EXPORT">
        <div className="export-buttons">
          <button
            className="btn-export"
            disabled={!asciiGrid}
            onClick={() => asciiGrid && downloadTextFile(asciiGrid, baseFilename)}
          >
            [SAVE .TXT]
          </button>
          <button
            className="btn-export"
            disabled={!asciiGrid}
            onClick={() =>
              asciiGrid &&
              downloadHtmlFile(asciiGrid, baseFilename, backgroundColor, foregroundColor)
            }
          >
            [SAVE .HTML]
          </button>
          <button
            className="btn-export"
            disabled={!asciiGrid}
            onClick={() =>
              asciiGrid &&
              downloadImageFile(asciiGrid, baseFilename, {
                backgroundColor,
                foregroundColor,
              })
            }
          >
            [SAVE .PNG]
          </button>
          <button
            className="btn-export"
            disabled={!asciiGrid}
            onClick={handleCopyToClipboard}
          >
            [COPY TEXT]
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}
