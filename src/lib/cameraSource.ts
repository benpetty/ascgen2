export type CameraFacing = 'user' | 'environment';

export interface CameraSource {
  start(options: { facing: CameraFacing }): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  flip(): Promise<void>;
  getFrame(): { source: HTMLVideoElement; width: number; height: number };
  isReady(): boolean;
}

export function createCameraSource(): CameraSource {
  const videoElement = document.createElement('video');
  videoElement.playsInline = true; // mandatory for iOS Safari to prevent fullscreen takeover
  videoElement.autoplay = true;
  videoElement.muted = true;

  let activeStream: MediaStream | null = null;
  let activeFacing: CameraFacing = 'user';

  async function start(options: { facing: CameraFacing }): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: options.facing },
      audio: false,
    });
    activeFacing = options.facing;
    activeStream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();
  }

  function pause(): void {
    videoElement.pause();
  }

  function resume(): void {
    videoElement.play().catch(() => {
      // Browsers may reject play() if the document loses user-activation; safe to ignore here
    });
  }

  function stop(): void {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    videoElement.srcObject = null;
    videoElement.pause();
  }

  async function flip(): Promise<void> {
    stop();
    const opposite: CameraFacing = activeFacing === 'user' ? 'environment' : 'user';
    await start({ facing: opposite });
  }

  function getFrame(): { source: HTMLVideoElement; width: number; height: number } {
    return {
      source: videoElement,
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
    };
  }

  function isReady(): boolean {
    return videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
  }

  return { start, pause, resume, stop, flip, getFrame, isReady };
}
