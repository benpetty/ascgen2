import React from 'react';

interface TerminalSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function TerminalSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: TerminalSliderProps) {

  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="slider-group">
        <input
          type="range"
          className="terminal-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          className="slider-number-input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const parsed = parseFloat(event.target.value);
            if (!isNaN(parsed)) {
              onChange(Math.max(min, Math.min(max, parsed)));
            }
          }}
        />
      </div>
    </div>
  );
}
