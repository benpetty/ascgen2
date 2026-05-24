import React from 'react';
import type { LiveStatus } from './useLiveAscii';

interface HeaderControlsProps {
  status: LiveStatus;
  isMobile: boolean;
  onStart: () => void;
  onStop: () => void;
  onFlip: () => void;
}

export function LiveHeaderControls({ status, isMobile, onStart, onStop, onFlip }: HeaderControlsProps) {
  if (status === 'idle') {
    return (
      <button className="btn-primary" onClick={onStart} type="button">
        [START CAMERA]
      </button>
    );
  }
  return (
    <>
      {isMobile && (
        <button className="btn-primary" onClick={onFlip} type="button">
          [FLIP]
        </button>
      )}
      <button className="btn-primary" onClick={onStop} type="button">
        [STOP CAMERA]
      </button>
    </>
  );
}

interface ToolbarControlsProps {
  status: LiveStatus;
  onSnapshot: () => void;
  onResume: () => void;
}

export function LiveToolbarControls({ status, onSnapshot, onResume }: ToolbarControlsProps) {
  if (status === 'streaming') {
    return (
      <button className="zoom-btn" onClick={onSnapshot} type="button">
        [SNAPSHOT]
      </button>
    );
  }
  if (status === 'paused') {
    return (
      <button className="zoom-btn" onClick={onResume} type="button">
        [RESUME]
      </button>
    );
  }
  return null;
}
