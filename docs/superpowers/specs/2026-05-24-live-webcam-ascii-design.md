# Live Webcam ASCII — Design Spec

- **Date:** 2026-05-24
- **Author:** Ben Petty + Claude (brainstorming session)
- **Status:** Approved design, not yet implemented
- **Branch:** `feat/live-webcam-ascii`

## Overview

Add a live webcam ASCII mode to ascgen2 so a visitor can point their device camera at the world (or themselves) and watch the feed convert to ASCII art in real time. Designed for two complementary use cases:

1. **Real-time mirror / fun demo** — point and watch.
2. **GitHub Pages showcase** — visual "wow factor" for visitors landing on `https://benpetty.github.io/ascgen2/`.

Recording, streaming output, OBS integration, and ASCII video export are explicitly out of scope.

## Decisions (settled during brainstorm)

| Question | Decision |
|---|---|
| Renderer in live mode | Imperative `<pre>.textContent` writes (grayscale-only). React reconciliation skipped on the per-frame path. |
| Color support in live | None. `colorMode` stays a stills-only feature; setting is preserved across transitions but ignored by the live renderer. |
| Snapshot semantics | Pause-in-place. Capture freezes the camera, routes the current frame through the existing still-image flow, sliders re-convert the frozen frame, RESUME unpauses. |
| Settings on START | Preserved as-is. No live-specific defaults; no reset on STOP. |
| Entry points | Two: header button (`[START CAMERA]`) and a drop-zone affordance ("or use camera"). Both trigger the same action. |
| Mobile support | First-class. Default `facingMode: 'environment'` when `window.innerWidth < 768`, with a `[FLIP]` control. `<video playsInline>` required for iOS Safari. Responsive default `outputWidth` (80 when `innerWidth < 768`, otherwise 120). |
| Filter pipeline | Refactor to in-place / ping-pong buffers as part of this work. Allocation-free in steady state. Allocation-regression test gates the invariant. |
| Workerized pipeline | Out of scope for v1. Documented as the next perf lever if main-thread perf disappoints. |

## State machine

```
                START CAMERA
       ┌─────────────────────────┐
       ▼                         │
    IDLE ◄──── STOP ────────  STREAMING ─── SNAPSHOT ──► PAUSED
    (no image,                (camera on,                (camera paused,
     drop zone)                imperative <pre>           AsciiGrid via
                               renderer, rAF loop)        existing React
                                  ▲                       grid renderer)
                                  │                          │
                                  └────── RESUME ────────────┘
```

Three live states layered on the existing IDLE / STILL flow:

- **`STREAMING`** — `getUserMedia` active; rAF loop drives pipeline → imperative `<pre>.textContent` writes. Settings sliders affect the live feed (debounce bypassed; rAF is fast enough). No per-frame `AsciiGrid` allocation.
- **`PAUSED`** — `MediaStreamTrack`s held in pause; last captured frame turned into an `AsciiGrid` and rendered through the existing React grid path in `AsciiPreview`. Sliders re-convert via the existing 80 ms-debounced `scheduleConversion`. All exporters work unchanged.
- **`IDLE` (with image loaded)** — exists today, untouched.

Key invariant: the conversion pipeline never forks. `pixelsToGrayscaleInto`, `applyFilterPipeline`, and `mapBrightnessToCharacter` are the same code in both paths — only the *renderer* differs.

## Components & modules

### New files (4)

- **`src/lib/cameraSource.ts`** — wraps `navigator.mediaDevices.getUserMedia` and a hidden `HTMLVideoElement`. Exposes:

  ```ts
  type CameraFacing = 'user' | 'environment';
  interface CameraSource {
    start(options: { facing: CameraFacing }): Promise<void>;
    pause(): void;        // stops rAF consumer; keeps tracks alive
    resume(): void;
    stop(): void;         // releases all MediaStream tracks
    flip(): Promise<void>; // restart with opposite facingMode
    getFrame(): { source: CanvasImageSource; width: number; height: number };
    isReady(): boolean;
  }
  ```

  Internals: creates one `<video playsInline autoplay muted>` element (the `playsInline` is mandatory for iOS Safari), attaches the stream, owns the `visibilitychange` listener.

- **`src/lib/liveAsciiRenderer.ts`** — single pure function:

  ```ts
  function renderGrayscaleToText(
    values: Uint8Array,
    width: number,
    height: number,
    ramp: string,
  ): string;
  ```

  Returns a single newline-joined string for `<pre>.textContent`. No DOM access.

- **`src/components/useLiveAscii.ts`** — React hook owning the rAF loop. Takes `settings`, returns `{ status, error, start, pause, resume, stop, flip, snapshot }`. `snapshot()` returns an `HTMLCanvasElement` of the captured frame so the caller can route it through the existing `setLoadedImage` flow. Owns the long-lived perf buffers (see "Per-frame data flow" below).

- **`src/components/LiveControls.tsx`** — header buttons (`[START CAMERA]` / `[STOP CAMERA]` / `[FLIP]`) and preview-toolbar buttons (`[SNAPSHOT]` / `[RESUME]`). State-driven via props.

### Modified files (4)

- **`src/lib/imageProcessor.ts`** — widen signatures to accept `CanvasImageSource`:

  ```ts
  // Before
  function extractGrayscaleValues(image: HTMLImageElement, w: number, h: number): GrayscaleImage;
  // After
  function extractGrayscaleValues(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
  ): GrayscaleImage;
  ```

  Same shape for `extractColorValues`. Body changes ~0 lines because `drawImage` already accepts `CanvasImageSource`. Add a new exported helper used by the live path:

  ```ts
  function pixelsToGrayscaleInto(rgbaData: Uint8ClampedArray, outputValues: Uint8Array): void;
  ```

  The existing `extractGrayscaleValues` becomes a thin wrapper that allocates a canvas + buffer for the still path and delegates to `pixelsToGrayscaleInto`.

- **`src/lib/asciiConverter.ts`** — `convertImageToAscii` reads `image.naturalWidth/Height` internally; widen to `getSourceDimensions(source)` so the snapshot canvas (which has `width` / `height`, not `naturalWidth`) flows through unchanged.

- **`src/components/App.tsx`** — add `cameraStatus: 'idle' | 'streaming' | 'paused'`. The existing `loadedImage` state now holds either `HTMLImageElement` (file) or `HTMLCanvasElement` (snapshot) — both are `CanvasImageSource`. Wire up `useLiveAscii` and `LiveControls`. Viewport-responsive default `outputWidth` computed once on mount: 80 when `window.innerWidth < 768`, otherwise 120.

- **`src/components/AsciiPreview.tsx`** — accept a `liveMode` boolean prop and a `livePreRef` ref. When `liveMode === true`, render an empty `<pre ref={livePreRef}>` instead of the React grid map. When false, behaves exactly as today. Add SNAPSHOT / RESUME buttons to the preview toolbar.

### Not touched

`asciiRamp.ts`, all exporters (`textExporter.ts`, `htmlExporter.ts`, `imageExporter.ts`), `types.ts` (no new types — `CanvasImageSource` is built-in).

## Per-frame data flow (perf-first)

### Long-lived resources owned by `useLiveAscii`

```ts
interface LiveResources {
  resizeCanvas: HTMLCanvasElement;       // sized to target dims
  resizeContext: CanvasRenderingContext2D;
  bufferA: Uint8Array;                   // grayscale buffer A
  bufferB: Uint8Array;                   // grayscale buffer B (ping-pong with A)
  targetWidth: number;
  targetHeight: number;
}
```

When the user moves the output-width slider in live mode, the next rAF tick detects the dimension change, resizes the canvas, and reallocates both buffers — exactly once. Every other tick reuses everything.

### Per rAF tick (steady state)

```ts
function tick() {
  if (status !== 'streaming') return;
  if (!cameraSource.isReady()) { rafHandle = requestAnimationFrame(tick); return; }

  const { source, width: sourceWidth, height: sourceHeight } = cameraSource.getFrame();
  const { width: targetWidth, height: targetHeight } =
    resolveOutputDimensions(sourceWidth, sourceHeight, settingsRef.current);

  // 1. Resize held canvas/buffers only if target dims changed (one-time cost on slider move)
  if (targetWidth !== resources.targetWidth || targetHeight !== resources.targetHeight) {
    resources.resizeCanvas.width = targetWidth;
    resources.resizeCanvas.height = targetHeight;
    resources.bufferA = new Uint8Array(targetWidth * targetHeight);
    resources.bufferB = new Uint8Array(targetWidth * targetHeight);
    resources.targetWidth = targetWidth;
    resources.targetHeight = targetHeight;
  }

  // 2. Draw video into held canvas. imageSmoothingQuality is 'low' (set once on context creation)
  //    — invisible at ASCII resolution, ~3-5x faster than 'high'.
  resources.resizeContext.drawImage(source, 0, 0, targetWidth, targetHeight);

  // 3. Read pixels into held grayscale buffer A
  const imageData = resources.resizeContext.getImageData(0, 0, targetWidth, targetHeight);
  pixelsToGrayscaleInto(imageData.data, resources.bufferA);

  // 4. Run filter pipeline (in-place, ping-pong between A and B)
  const finalBuffer = applyFilterPipeline(
    resources.bufferA, resources.bufferB, targetWidth, targetHeight, settingsRef.current,
  );

  // 5. Render to string and update <pre> (one string assignment, no React)
  const ramp = settingsRef.current.invertRamp
    ? reverseRamp(settingsRef.current.characterRamp)
    : settingsRef.current.characterRamp;
  preRef.current.textContent =
    renderGrayscaleToText(finalBuffer, targetWidth, targetHeight, ramp);

  rafHandle = requestAnimationFrame(tick);
}
```

**Steady-state allocation per frame:** one `ImageData` (the browser allocates this; cannot be reused via the standard API) plus one result string. Everything else is reused across frames. Filter pipeline allocates **zero** in steady state.

`getImageData` is the unavoidable allocation floor without going to `OffscreenCanvas` + Worker (out of scope).

The rAF loop reads `settings` via a `useRef` mirror — slider changes take effect on the very next frame with no debounce. The existing `scheduleConversion` debounce only fires in STILL / PAUSED.

### Filter pipeline refactor (mandatory for perf invariant)

Six filter functions change signature from "return new image" to "write into provided output":

```ts
// Before
function applyStretchFilter(image: GrayscaleImage): GrayscaleImage;

// After
function applyStretchFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void;
```

Same shape for `applyBrightnessContrastFilter`, `applyLevelsFilter`, `applySharpenFilter`, `applyUnsharpMaskFilter`, `applyDitherFilter`, `applyFlipHorizontalFilter`, `applyFlipVerticalFilter`.

`applyFilterPipeline` becomes:

```ts
function applyFilterPipeline(
  inputBuffer: Uint8Array,
  scratchBuffer: Uint8Array,
  width: number,
  height: number,
  settings: ConversionSettings,
): Uint8Array {
  let read = inputBuffer;
  let write = scratchBuffer;

  if (settings.applyStretch) {
    applyStretchFilter(read, write, width, height);
    [read, write] = [write, read];
  }
  // ... same swap pattern per enabled filter
  return read;
}
```

Edge cases:

- **No-op filters** (e.g. brightness=0 + contrast=0): pipeline skips them entirely — no copy needed, no swap.
- **Stretch's "all pixels same value" early-return:** becomes `outputValues.set(inputValues)` — one fast memcpy.
- **Sharpen / unsharp / flip-vertical** need separate read/write buffers (convolutions read neighbors; flip-vertical reads from the other end of the column). Ping-pong handles this naturally.
- **Flip-horizontal** could be in-place but ping-pong is simpler and identical per-pixel cost.

Still path benefits too: each slider drag allocates two buffers once instead of one-per-filter, and gets the no-op skip free.

### Snapshot, Resume, Stop, Flip

- **SNAPSHOT:** `cameraSource.pause()`; `drawImage(video)` into a fresh `<canvas>`; `setLoadedImage(snapCanvas)`; `setCameraStatus('paused')`. Existing `useEffect([loadedImage, settings])` flow re-converts via `scheduleConversion`. AsciiPreview re-renders with `liveMode={false}`, using the existing React grid.
- **RESUME:** `setLoadedImage(null); setAsciiGrid(null); setCameraStatus('streaming')`; restart rAF loop.
- **STOP:** `cancelAnimationFrame(rafHandle); cameraSource.stop()`; drop long-lived buffers (GC reclaims). Return to drop-zone.
- **FLIP:** `cameraSource.stop()` → `cameraSource.start({ facing: opposite })`. rAF loop continues; first frames after flip may render the prior dimensions briefly until the video element reports new ones, then resolves naturally.

### Page Visibility — auto-pause

```ts
document.addEventListener('visibilitychange', () => {
  if (document.hidden && cameraStatus === 'streaming') {
    cancelAnimationFrame(rafHandle);
    videoElement.pause();
    // cameraStatus stays 'streaming' — this is implicit, not user-initiated
  } else if (!document.hidden && cameraStatus === 'streaming') {
    videoElement.play();
    rafHandle = requestAnimationFrame(tick);
  }
});
```

Two perf wins: backgrounded tab doesn't burn CPU; battery save on mobile. Deliberately doesn't stop the `MediaStream` (would re-prompt permissions on some browsers).

## Error handling & lifecycle

### `getUserMedia` failure paths

```ts
const messages: Record<string, string> = {
  NotAllowedError:      'Camera permission denied. Check your browser site settings.',
  NotFoundError:        'No camera detected on this device.',
  NotReadableError:     'Camera is in use by another app.',
  OverconstrainedError: 'Requested camera mode unavailable. Try the flip-camera button.',
  SecurityError:        'Camera access requires a secure (https://) connection.',
};
```

All surface via existing `errorMessage` state, displayed in `AsciiPreview`'s `status-overlay`. rAF loop never starts if `start()` rejects.

### Teardown

Three triggers funnel through one cleanup:

```ts
function teardown() {
  cancelAnimationFrame(rafHandle);
  stream?.getTracks().forEach(track => track.stop());  // releases camera hardware
  videoElement.srcObject = null;
  videoElement.pause();
  resources = null;
}
```

Triggers:
1. User clicks `STOP`
2. Component unmount (useEffect cleanup)
3. Hard error during pipeline (`setErrorMessage` + `teardown` + return to `idle`)

Browser's camera-on indicator is the user-visible verification that tracks were actually stopped.

### Pipeline errors during a tick

The pipeline is pure typed-array arithmetic — no IO, no way to throw in steady state. The remaining risk is canvas operations: `drawImage` can throw `InvalidStateError` between facingMode swaps; `getImageData` could throw `SecurityError` on a tainted canvas (impossible here since we never draw cross-origin sources, but defended against).

Guard the tick body in `try/catch`; on throw, log to console, `setErrorMessage(...)`, `teardown()`, return to `idle`. No mid-stream recovery — clean break + ask the user to click `START CAMERA` again.

### Not handled (deliberate)

- **Mid-stream device disconnect** — `MediaStreamTrack` fires `ended` event; the next `drawImage` throws and triggers the generic recovery path. Acceptable.
- **Multiple-camera picker** — flip toggles `user` ↔ `environment` only. Rare third-camera selection is a follow-up.
- **Auto-retry** — user re-clicks `START CAMERA`. Simpler, less surprising.

## Testing strategy

### Updated existing tests (6 filter files)

Each filter test changes signature with the refactor:

```ts
// Before
const result = applyStretchFilter(input);
expect(result.values).toEqual(...);
// After
const output = new Uint8Array(input.values.length);
applyStretchFilter(input.values, output, input.width, input.height);
expect(output).toEqual(...);
```

Plus one new test per filter: **input not mutated when separate output provided**. Catches accidental in-place writes that would corrupt convolutions.

### New test files (4)

- **`src/lib/__tests__/filterPipeline.test.ts`** — the ping-pong orchestrator and the perf invariant:
  - **No-op pipeline returns input unchanged:** brightness=0 + contrast=0 + dither=0 → `applyFilterPipeline` returns the input buffer (same reference).
  - **Parity vs. old chained-allocation behavior:** seeded with existing filter test fixtures, assert byte-for-byte equality.
  - **Zero-allocation invariant:** wrap `Uint8Array` constructor with `vi.spyOn`; assert 100 pipeline invocations on pre-allocated buffers produce zero new `Uint8Array` allocations. This is the perf-regression gate.

- **`src/lib/__tests__/cameraSource.test.ts`** — mock-driven via `vi.stubGlobal('navigator', ...)`:
  - `start({ facing: 'user' | 'environment' })` invokes `getUserMedia` with correct `facingMode`
  - `flip()` stops old tracks and re-calls `getUserMedia` with opposite `facingMode`
  - `stop()` calls `track.stop()` on every track
  - Error mapping: `DOMException('NotAllowedError')` → friendly message
  - `visibilitychange` dispatched → `videoElement.pause()` called

- **`src/lib/__tests__/liveAsciiRenderer.test.ts`** — pure function:
  - Known input + ramp → exact string output
  - Newline placement: width=4, height=2 → exactly one `\n` at offset 4
  - Boundary chars: brightness=0 → first ramp char, brightness=255 → last
  - Output length: `width * height + height`

- **`src/lib/__tests__/imageProcessor.test.ts`** — add tests for `pixelsToGrayscaleInto` (pure typed-array math, JSDOM-friendly). Existing `extractGrayscaleValues` tests stay.

### New benchmark file

- **`src/lib/__bench__/filterPipeline.bench.ts`** — Vitest `bench` suite for the filter pipeline at the live grid sizes (80×40, 100×50). Runs locally on demand; not gated in CI (timing variance too noisy). Results live in the PR description for perf-aware review.

### Manual smoke-test checklist (in PR description)

Things JSDOM can't replicate, not worth Playwright scaffolding for v1:

- [ ] Camera permission prompt appears on first START CAMERA click
- [ ] 60 FPS sustained at default settings on a mid-range laptop
- [ ] iOS Safari: video does NOT go fullscreen on play (verifies `playsInline`)
- [ ] iOS Safari: rear camera default on first START
- [ ] FLIP toggles between front and rear cameras
- [ ] Hide tab → camera indicator stays on but no CPU usage; show tab → frames resume
- [ ] SNAPSHOT → slider drag → frame re-converts → RESUME → live updates resume
- [ ] STOP → browser camera indicator turns off
- [ ] Permission denied → friendly error message in status overlay
- [ ] Narrow viewport (375 px) → default output width is 80, layout is touch-friendly

### CI consideration

Project's deploy workflow runs only `astro build` today. Adding a `test.yml` workflow that runs `npm test && npm run lint` on PRs would lock the perf-regression invariant in for everyone. **Recommend a separate small PR** alongside this one — keeps each reviewable and avoids coupling test-infrastructure churn to feature scope.

## Out of scope (deliberate)

These are *not* in v1 to keep scope honest:

- **Color in live mode** — `colorMode` setting preserved across transitions but ignored by the live renderer.
- **Recording / `MediaRecorder` output** — no "save as ASCII video" feature.
- **Stream output via `canvas.captureStream()`** — no OBS / virtual-camera capability.
- **OffscreenCanvas + Worker pipeline** — documented as the next perf lever; main thread handles 80×40 just fine.
- **WebAssembly filter implementations** — only worth it for sharpen/unsharp convolutions; everything else is already linear typed-array scans.
- **`requestVideoFrameCallback`** instead of `rAF` — small marginal win, browser support uneven, defer.
- **Camera device picker beyond simple flip** — rare third-camera selection.
- **Playwright E2E test scaffolding** — large scope expansion; manual checklist for v1.

## Build sequence (rough)

This is *not* the implementation plan — `writing-plans` produces that next — but the rough order:

1. Refactor `imageProcessor.ts` to add `pixelsToGrayscaleInto`; widen signatures to `CanvasImageSource`. Tests updated.
2. Refactor all six filters to in-place / ping-pong; update tests; add `filterPipeline.test.ts` with the zero-allocation gate. **Verify the full test suite still passes** at this checkpoint before moving on.
3. Build `cameraSource.ts` with tests.
4. Build `liveAsciiRenderer.ts` with tests.
5. Build `useLiveAscii.ts` hook (composition; tested mostly via manual smoke).
6. Build `LiveControls.tsx`.
7. Wire into `App.tsx` and `AsciiPreview.tsx` (header + drop-zone entry points; toolbar buttons).
8. Add `filterPipeline.bench.ts`.
9. Manual smoke-test pass through the checklist.
10. Open PR; open the separate `test.yml` CI PR alongside.

## Open items / future work

- `test.yml` CI workflow (separate PR).
- If main-thread perf disappoints on low-end mobile, move pipeline to a Worker with `OffscreenCanvas`.
- Snapshot-to-clipboard one-click (currently goes through the existing export menu).
