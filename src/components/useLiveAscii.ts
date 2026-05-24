import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createCameraSource, type CameraFacing, type CameraSource } from '../lib/cameraSource';
import { pixelsToGrayscaleInto, calculateAutoOutputHeight } from '../lib/imageProcessor';
import { applyFilterPipeline } from '../lib/asciiConverter';
import { renderGrayscaleToText } from '../lib/liveAsciiRenderer';
import { reverseRamp } from '../lib/asciiRamp';
import type { ConversionSettings } from '../lib/types';

export type LiveStatus = 'idle' | 'streaming' | 'paused';

// Issue 4: DOMException name → user-facing message table, shared by start() and flip().
const CAMERA_EXCEPTION_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Camera permission denied. Check your browser site settings.',
  NotFoundError: 'No camera detected on this device.',
  NotReadableError: 'Camera is in use by another app.',
  OverconstrainedError: 'Requested camera mode unavailable. Try the flip-camera button.',
  SecurityError: 'Camera access requires a secure (https://) connection.',
};

interface LiveResources {
  resizeCanvas: HTMLCanvasElement;
  resizeContext: CanvasRenderingContext2D;
  bufferA: Uint8Array;
  bufferB: Uint8Array;
  targetWidth: number;
  targetHeight: number;
}

function makeResources(targetWidth: number, targetHeight: number): LiveResources {
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = targetWidth;
  resizeCanvas.height = targetHeight;
  const resizeContext = resizeCanvas.getContext('2d');
  if (!resizeContext) {
    throw new Error('Failed to obtain 2D canvas context for live ASCII renderer');
  }
  resizeContext.imageSmoothingEnabled = true;
  resizeContext.imageSmoothingQuality = 'low'; // 'high' is too slow for live
  return {
    resizeCanvas,
    resizeContext,
    bufferA: new Uint8Array(targetWidth * targetHeight),
    bufferB: new Uint8Array(targetWidth * targetHeight),
    targetWidth,
    targetHeight,
  };
}

function resolveLiveOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  settings: ConversionSettings,
): { width: number; height: number } {
  const outputWidth = Math.max(1, settings.outputWidth);
  const outputHeight =
    settings.outputHeight > 0 && !settings.maintainAspectRatio
      ? settings.outputHeight
      : calculateAutoOutputHeight(
          sourceWidth,
          sourceHeight,
          outputWidth,
          settings.characterAspectRatio,
        );
  return { width: outputWidth, height: Math.max(1, outputHeight) };
}

interface UseLiveAsciiReturn {
  status: LiveStatus;
  error: string | null;
  start: (facing: CameraFacing) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  flip: () => Promise<void>;
  snapshot: () => HTMLCanvasElement | null;
}

export function useLiveAscii(
  settings: ConversionSettings,
  preRef: React.MutableRefObject<HTMLPreElement | null>,
): UseLiveAsciiReturn {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraSource | null>(null);
  const resourcesRef = useRef<LiveResources | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const statusRef = useRef<LiveStatus>('idle');
  const settingsRef = useRef(settings);

  // Issue 3: Cache the resolved ramp so reverseRamp() is not called on every rAF tick.
  // Updated alongside settingsRef in the same useLayoutEffect.
  const resolvedRampRef = useRef<string>(
    settings.invertRamp ? reverseRamp(settings.characterRamp) : settings.characterRamp,
  );

  useLayoutEffect(() => {
    settingsRef.current = settings;
    resolvedRampRef.current = settings.invertRamp
      ? reverseRamp(settings.characterRamp)
      : settings.characterRamp;
  });

  useLayoutEffect(() => {
    statusRef.current = status;
  });

  // tickRef holds the latest tick function so the rAF loop can call itself without
  // a circular useCallback dependency (tick referencing tick before it is declared).
  const tickRef = useRef<() => void>(() => undefined);

  const teardown = useCallback(() => {
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    cameraRef.current?.stop();
    cameraRef.current = null;
    resourcesRef.current = null;
    setStatus('idle');
  }, []);

  const tick = useCallback(() => {
    const camera = cameraRef.current;
    const pre = preRef.current;
    if (!camera || !pre) return;
    if (statusRef.current !== 'streaming') return;
    if (!camera.isReady()) {
      rafHandleRef.current = requestAnimationFrame(tickRef.current);
      return;
    }

    const { source, width: sourceWidth, height: sourceHeight } = camera.getFrame();
    const { width: targetWidth, height: targetHeight } = resolveLiveOutputDimensions(
      sourceWidth, sourceHeight, settingsRef.current,
    );

    let resources = resourcesRef.current;
    if (
      !resources ||
      targetWidth !== resources.targetWidth ||
      targetHeight !== resources.targetHeight
    ) {
      resources = makeResources(targetWidth, targetHeight);
      resourcesRef.current = resources;
    }

    try {
      resources.resizeContext.drawImage(source, 0, 0, targetWidth, targetHeight);
      const imageData = resources.resizeContext.getImageData(0, 0, targetWidth, targetHeight);
      pixelsToGrayscaleInto(imageData.data, resources.bufferA);
      const finalBuffer = applyFilterPipeline(
        resources.bufferA, resources.bufferB, targetWidth, targetHeight, settingsRef.current,
      );
      // Issue 3: Use cached resolvedRampRef instead of calling reverseRamp() every tick.
      pre.textContent = renderGrayscaleToText(
        finalBuffer,
        targetWidth,
        targetHeight,
        resolvedRampRef.current,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Frame conversion failed';
      setError(`Live conversion error: ${message}`);
      teardown();
      return;
    }

    rafHandleRef.current = requestAnimationFrame(tickRef.current);
  }, [preRef, teardown]);

  useLayoutEffect(() => {
    tickRef.current = tick;
  });

  const start = useCallback(async (facing: CameraFacing) => {
    setError(null);
    try {
      cameraRef.current = createCameraSource();
      await cameraRef.current.start({ facing });
      setStatus('streaming');
      // Issue 1: Use tickRef.current so the seed rAF call uses the latest tick closure.
      rafHandleRef.current = requestAnimationFrame(tickRef.current);
    } catch (caught) {
      const errorName = caught instanceof DOMException ? caught.name : 'Unknown';
      // Issue 4: Use shared CAMERA_EXCEPTION_MESSAGES constant.
      setError(CAMERA_EXCEPTION_MESSAGES[errorName] ?? `Camera error: ${errorName}`);
      cameraRef.current = null;
      setStatus('idle');
    }
  }, []);

  const pause = useCallback(() => {
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    cameraRef.current?.pause();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    cameraRef.current?.resume();
    setStatus('streaming');
    // Issue 1: Use tickRef.current so the seed rAF call uses the latest tick closure.
    rafHandleRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const stop = teardown;

  const flip = useCallback(async () => {
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    try {
      await cameraRef.current?.flip();
      // Issue 1: Use tickRef.current so the seed rAF call uses the latest tick closure.
      rafHandleRef.current = requestAnimationFrame(tickRef.current);
    } catch (caught) {
      const errorName = caught instanceof DOMException ? caught.name : 'Unknown';
      // Issue 4: Use shared CAMERA_EXCEPTION_MESSAGES constant.
      setError(CAMERA_EXCEPTION_MESSAGES[errorName] ?? `Camera error: ${errorName}`);
      cameraRef.current = null;
      setStatus('idle');
    }
  }, []);

  // Snapshot intentionally pauses the live feed and returns the current frame as a canvas.
  // The caller is expected to route the canvas through their state and call resume() when
  // the user wants to return to live streaming. This matches the "freeze in place" UX.
  const snapshot = useCallback((): HTMLCanvasElement | null => {
    const camera = cameraRef.current;
    if (!camera || !camera.isReady()) return null;
    const { source, width, height } = camera.getFrame();
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    const snapContext = snapCanvas.getContext('2d');
    if (!snapContext) {
      setError('Failed to capture snapshot: 2D canvas context unavailable.');
      return null;
    }
    pause();
    snapContext.drawImage(source, 0, 0);
    return snapCanvas;
  }, [pause]);

  // Page Visibility — auto-pause when tab hidden, resume when shown.
  // Uses refs exclusively so this effect never needs to re-run.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (statusRef.current !== 'streaming') return;
      if (document.hidden) {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        cameraRef.current?.pause();
      } else {
        cameraRef.current?.resume();
        // Issue 1: Use tickRef.current so the seed rAF call uses the latest tick closure.
        rafHandleRef.current = requestAnimationFrame(tickRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []); // empty deps — uses only refs

  // Component-unmount cleanup
  useEffect(() => {
    return () => teardown();
  }, [teardown]);

  return { status, error, start, pause, resume, stop, flip, snapshot };
}
