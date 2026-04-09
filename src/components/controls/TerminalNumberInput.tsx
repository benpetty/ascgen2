import React from 'react';

interface TerminalNumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

export function TerminalNumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  placeholder,
}: TerminalNumberInputProps) {
  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <input
        type="number"
        className="terminal-input"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => {
          const parsed = parseInt(event.target.value, 10);
          if (!isNaN(parsed)) {
            const clamped = Math.max(min ?? parsed, Math.min(max ?? parsed, parsed));
            onChange(clamped);
          }
        }}
      />
    </div>
  );
}
