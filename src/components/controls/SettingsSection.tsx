import React from 'react';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SettingsSection({ title, children, defaultOpen = true }: SettingsSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="settings-section">
      <button
        className="settings-section-header"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="section-toggle">{isOpen ? '▼' : '▶'}</span>
        <span className="section-title">{title}</span>
      </button>
      {isOpen && (
        <div className="settings-section-body">
          {children}
        </div>
      )}
    </div>
  );
}
