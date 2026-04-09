import React from 'react';

interface TerminalCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function TerminalCheckbox({ label, checked, onChange, disabled = false }: TerminalCheckboxProps) {
  return (
    <label className={`control-checkbox ${disabled ? 'control-disabled' : ''}`}>
      <span className="checkbox-box">{checked ? '[x]' : '[ ]'}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ display: 'none' }}
      />
      <span className="checkbox-label">{label}</span>
    </label>
  );
}
