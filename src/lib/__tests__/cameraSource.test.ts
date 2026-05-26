// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCameraSource } from '../cameraSource';

interface MockTrack {
  stop: ReturnType<typeof vi.fn>;
}
interface MockMediaStream {
  getTracks: () => MockTrack[];
}

function makeMockStream(): MockMediaStream {
  const tracks: MockTrack[] = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { getTracks: () => tracks };
}

describe('createCameraSource', () => {
  let mockStream: MockMediaStream;
  let getUserMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStream = makeMockStream();
    getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('start({ facing: "user" }) requests user-facing camera, no audio', async () => {
    const camera = createCameraSource();
    await camera.start({ facing: 'user' });
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'user' },
      audio: false,
    });
  });

  it('start({ facing: "environment" }) requests rear camera', async () => {
    const camera = createCameraSource();
    await camera.start({ facing: 'environment' });
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
  });

  it('stop() calls track.stop() on every track', async () => {
    const camera = createCameraSource();
    await camera.start({ facing: 'user' });
    const tracks = mockStream.getTracks();
    camera.stop();
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(tracks[1].stop).toHaveBeenCalled();
  });

  it('flip() stops the prior stream and starts a new one with opposite facing', async () => {
    const camera = createCameraSource();
    await camera.start({ facing: 'user' });
    const tracksBeforeFlip = mockStream.getTracks();

    mockStream = makeMockStream();
    getUserMediaMock.mockResolvedValueOnce(mockStream);

    await camera.flip();

    expect(tracksBeforeFlip[0].stop).toHaveBeenCalled();
    expect(getUserMediaMock).toHaveBeenLastCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
  });

  it('propagates getUserMedia rejections', async () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    getUserMediaMock.mockRejectedValueOnce(error);
    const camera = createCameraSource();
    await expect(camera.start({ facing: 'user' })).rejects.toBe(error);
  });

  it('isReady() returns false before start and false after start in test env (JSDOM has no real video)', async () => {
    const camera = createCameraSource();
    expect(camera.isReady()).toBe(false);
    await camera.start({ facing: 'user' });
    // JSDOM does not provide real videoWidth/videoHeight, so they stay at 0.
    // isReady()'s contract — true only when dimensions > 0 — means false here.
    expect(camera.isReady()).toBe(false);
  });
});
