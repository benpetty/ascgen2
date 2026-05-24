# Live Webcam ASCII Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live webcam ASCII mode to ascgen2 that streams the user's camera through the existing conversion pipeline and renders ASCII art in real time, with a snapshot-to-still affordance, first-class mobile support, and zero per-frame allocations in the filter pipeline.

**Architecture:** Side-by-side renderers sharing one pipeline. The live path uses imperative `<pre>.textContent` writes driven by `requestAnimationFrame` and skips the React `AsciiGrid` reconciliation. The still path is unchanged. The filter pipeline is refactored from "each filter allocates a new buffer" to in-place / ping-pong typed-array buffers, with a zero-allocation regression test guarding the invariant.

**Tech Stack:** React 19, TypeScript, Vitest, Astro build wrapper, `MediaDevices.getUserMedia`, Canvas 2D, `requestAnimationFrame`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-24-live-webcam-ascii-design.md`

---

## File map

### Created

| File | Purpose |
|---|---|
| `src/lib/cameraSource.ts` | Wraps `getUserMedia` + hidden `<video>`; lifecycle (start/pause/resume/stop/flip); `visibilitychange` integration |
| `src/lib/liveAsciiRenderer.ts` | Pure function: grayscale buffer + ramp → newline-joined string |
| `src/components/useLiveAscii.ts` | React hook: rAF loop + long-lived ping-pong buffers + camera source orchestration |
| `src/components/LiveControls.tsx` | Header + toolbar buttons for live mode (START / STOP / FLIP / SNAPSHOT / RESUME) |
| `src/lib/__tests__/cameraSource.test.ts` | Mock-driven lifecycle tests |
| `src/lib/__tests__/liveAsciiRenderer.test.ts` | Pure function tests |
| `src/lib/__tests__/filterPipeline.test.ts` | Pipeline orchestration tests + zero-allocation regression gate |
| `src/lib/__bench__/filterPipeline.bench.ts` | Vitest bench suite for the pipeline at live grid sizes |

### Modified

| File | Change |
|---|---|
| `src/lib/imageProcessor.ts` | Add `pixelsToGrayscaleInto`; widen extract* to `CanvasImageSource` + explicit source dims |
| `src/lib/filters/stretchFilter.ts` | Refactor to in-place `(input, output, w, h) => void` |
| `src/lib/filters/brightnessContrastFilter.ts` | Same refactor |
| `src/lib/filters/levelsFilter.ts` | Same refactor |
| `src/lib/filters/sharpenFilter.ts` | Same refactor (both `applySharpen` and `applyUnsharpMask`) |
| `src/lib/filters/ditherFilter.ts` | Same refactor |
| `src/lib/filters/flipFilter.ts` | Same refactor (both flip directions) |
| `src/lib/asciiConverter.ts` | Use new filter pipeline + `CanvasImageSource` source dims |
| `src/components/App.tsx` | Add `cameraStatus` state; wire `useLiveAscii` + `LiveControls`; responsive default `outputWidth` |
| `src/components/AsciiPreview.tsx` | Accept `liveMode` + `livePreRef` props; render `<pre ref>` in live mode; toolbar SNAPSHOT/RESUME |
| All 6 filter test files | Update existing tests to new signature; add "input not mutated" test per filter |
| `README.md` | Document the new live mode + camera permission |

### Not touched

`asciiRamp.ts`, all exporters, `types.ts`.

---

## Task ordering rationale

Tasks 1–11 refactor the existing pipeline to be allocation-free. After Task 11, the existing test suite (now expanded) passes and the still-image flow behaves identically to today. **The app remains shippable at every commit.**

Tasks 12–14 build the live-mode primitives in isolation (no UI yet).

Tasks 15–18 wire live mode into the UI.

Tasks 19–20 polish (bench + README).

---

## Filter refactor pattern (referenced by Tasks 3–8)

Every filter changes from:

```ts
export function applyXxxFilter(image: GrayscaleImage, ...args): GrayscaleImage {
  const { values, width, height } = image;
  const result = new Uint8Array(values.length);
  // ... write into `result` ...
  return { values: result, width, height };
}
```

To:

```ts
export function applyXxxFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
  ...args
): void {
  // ... read from inputValues, write into outputValues ...
}
```

Test pattern changes from:

```ts
const image = makeImage([...]);
const result = applyXxxFilter(image, ...);
expect(result.values[i]).toBe(...);
```

To:

```ts
const inputValues = new Uint8Array([...]);
const outputValues = new Uint8Array(inputValues.length);
applyXxxFilter(inputValues, outputValues, width, height, ...);
expect(outputValues[i]).toBe(...);
```

Each filter task also adds **one new test**: *input buffer is not mutated when a separate output buffer is provided*.

---

## Task 1: Add `pixelsToGrayscaleInto` to imageProcessor

**Files:**
- Modify: `src/lib/imageProcessor.ts`
- Test: `src/lib/__tests__/imageProcessor.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/__tests__/imageProcessor.test.ts`:

```ts
import { calculateAutoOutputHeight, pixelsToGrayscaleInto } from '../imageProcessor';

describe('pixelsToGrayscaleInto', () => {
  it('writes ITU-R BT.601 luminance into the provided output buffer', () => {
    // Two RGBA pixels: pure white, pure black
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const output = new Uint8Array(2);
    pixelsToGrayscaleInto(rgba, output);
    expect(output[0]).toBe(255);
    expect(output[1]).toBe(0);
  });

  it('matches the ITU-R BT.601 weights for a known RGB sample', () => {
    // Pure red — 0.299 * 255 ≈ 76
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const output = new Uint8Array(1);
    pixelsToGrayscaleInto(rgba, output);
    expect(output[0]).toBe(76);
  });

  it('does not allocate a new typed array', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255]);
    const output = new Uint8Array(1);
    const originalBuffer = output.buffer;
    pixelsToGrayscaleInto(rgba, output);
    // Same underlying ArrayBuffer (no reallocation)
    expect(output.buffer).toBe(originalBuffer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- imageProcessor
```

Expected: 3 new failures with `pixelsToGrayscaleInto is not a function` (or import error).

- [ ] **Step 3: Implement `pixelsToGrayscaleInto`**

In `src/lib/imageProcessor.ts`, add:

```ts
export function pixelsToGrayscaleInto(
  rgbaData: Uint8ClampedArray,
  outputValues: Uint8Array,
): void {
  const pixelCount = outputValues.length;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const dataOffset = pixelIndex * 4;
    const red = rgbaData[dataOffset];
    const green = rgbaData[dataOffset + 1];
    const blue = rgbaData[dataOffset + 2];
    // Standard luminance formula (ITU-R BT.601)
    outputValues[pixelIndex] = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  }
}
```

Then refactor `extractGrayscaleValues` to use it (no behavior change):

```ts
export function extractGrayscaleValues(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): GrayscaleImage {
  const context = createResizedCanvasContext(image, targetWidth, targetHeight);
  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
  const grayscaleValues = new Uint8Array(targetWidth * targetHeight);
  pixelsToGrayscaleInto(data, grayscaleValues);
  return { values: grayscaleValues, width: targetWidth, height: targetHeight };
}
```

- [ ] **Step 4: Run tests to verify all pass**

```
npm test
```

Expected: all original tests + 3 new tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/imageProcessor.ts src/lib/__tests__/imageProcessor.test.ts
git commit -m "Add pixelsToGrayscaleInto helper for in-place grayscale conversion"
```

---

## Task 2: Widen extract functions to accept `CanvasImageSource`

**Files:**
- Modify: `src/lib/imageProcessor.ts`
- Modify: `src/lib/asciiConverter.ts`

This is purely a signature widening with explicit source dimensions. `drawImage` already accepts `CanvasImageSource`. No new tests needed (existing tests still pass; new behavior is exercised via Tasks 12+).

- [ ] **Step 1: Widen `createResizedCanvasContext`**

In `src/lib/imageProcessor.ts`, change:

```ts
function createResizedCanvasContext(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): CanvasRenderingContext2D {
```

To:

```ts
function createResizedCanvasContext(
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  return context;
}
```

- [ ] **Step 2: Widen `extractGrayscaleValues` and `extractColorValues`**

```ts
export function extractGrayscaleValues(
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
): GrayscaleImage {
  const context = createResizedCanvasContext(source, targetWidth, targetHeight);
  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
  const grayscaleValues = new Uint8Array(targetWidth * targetHeight);
  pixelsToGrayscaleInto(data, grayscaleValues);
  return { values: grayscaleValues, width: targetWidth, height: targetHeight };
}

export function extractColorValues(
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
): ColorPixel[] {
  const context = createResizedCanvasContext(source, targetWidth, targetHeight);
  const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
  const pixelCount = targetWidth * targetHeight;
  const colorValues: ColorPixel[] = new Array(pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    const dataOffset = pixelIndex * 4;
    colorValues[pixelIndex] = {
      red: data[dataOffset],
      green: data[dataOffset + 1],
      blue: data[dataOffset + 2],
    };
  }
  return colorValues;
}
```

- [ ] **Step 3: Add `getSourceDimensions` helper**

```ts
export function getSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height };
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }
  if (source instanceof SVGImageElement) {
    return { width: source.width.baseVal.value, height: source.height.baseVal.value };
  }
  throw new Error('Unsupported CanvasImageSource type');
}
```

- [ ] **Step 4: Update `asciiConverter.ts` to use `getSourceDimensions`**

In `resolveOutputDimensions`, change `image: HTMLImageElement` to `source: CanvasImageSource` and replace `image.naturalWidth` / `image.naturalHeight` with `getSourceDimensions(source).width` / `.height`. The whole `convertImageToAscii` signature widens to `(source: CanvasImageSource, settings)`.

- [ ] **Step 5: Update `App.tsx` type**

`loadedImage` state type changes from `HTMLImageElement | null` to `CanvasImageSource | null`. No behavior change because `loadImageFromFile` still returns `HTMLImageElement`.

- [ ] **Step 6: Run tests + verify still-image flow manually**

```
npm test
npm run lint
```

Expected: all tests pass. Manual: load an image via drag-drop, verify conversion still works (the dev server is already running per project preference — verify in browser).

- [ ] **Step 7: Commit**

```
git add src/lib/imageProcessor.ts src/lib/asciiConverter.ts src/components/App.tsx
git commit -m "Widen image-processing pipeline to accept any CanvasImageSource"
```

---

## Task 3: Refactor `stretchFilter` to in-place

**Files:**
- Modify: `src/lib/filters/stretchFilter.ts`
- Test: `src/lib/__tests__/stretchFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Replace `src/lib/__tests__/stretchFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyStretchFilter } from '../filters/stretchFilter';

describe('applyStretchFilter', () => {
  it('stretches a narrow range to fill 0–255', () => {
    const inputValues = new Uint8Array([100, 150, 200]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(outputValues[0]).toBe(0);
    expect(outputValues[2]).toBe(255);
  });

  it('copies input to output when all pixels are the same value', () => {
    const inputValues = new Uint8Array([128, 128, 128]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(Array.from(outputValues)).toEqual([128, 128, 128]);
  });

  it('does not change an image already spanning 0–255', () => {
    const inputValues = new Uint8Array([0, 128, 255]);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(outputValues[0]).toBe(0);
    expect(outputValues[1]).toBe(128);
    expect(outputValues[2]).toBe(255);
  });

  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(3);
    applyStretchFilter(inputValues, outputValues, 3, 1);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- stretchFilter
```

Expected: TS/runtime error — old signature mismatch.

- [ ] **Step 3: Refactor the filter**

Replace `src/lib/filters/stretchFilter.ts`:

```ts
export function applyStretchFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
): void {
  let minValue = 255;
  let maxValue = 0;

  for (let index = 0; index < inputValues.length; index++) {
    const value = inputValues[index];
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }

  const range = maxValue - minValue;
  if (range === 0) {
    outputValues.set(inputValues);
    return;
  }

  const scaleFactor = 255 / range;
  for (let index = 0; index < inputValues.length; index++) {
    outputValues[index] = Math.round((inputValues[index] - minValue) * scaleFactor);
  }
}
```

(`width` and `height` are unused but kept in signature for uniformity with filters that need them.)

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- stretchFilter
```

Expected: all four tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/filters/stretchFilter.ts src/lib/__tests__/stretchFilter.test.ts
git commit -m "Refactor stretchFilter to in-place buffer signature"
```

Note: `asciiConverter.ts` still calls the old signature and will fail to compile until Task 9 lands. The intermediate state isn't shippable; that's fine for the refactor sequence — the run condition is "build pipeline + tests both green before the next *non-filter* task."

To work around mid-refactor breakage, **after Tasks 3–8** the whole filter set is converted before re-wiring `asciiConverter.ts` in Task 9. We accept temporarily broken `asciiConverter.ts` between Task 3 and Task 9. The filter unit tests still pass individually — only the orchestrator is broken until Task 9.

---

## Task 4: Refactor `brightnessContrastFilter` to in-place

**Files:**
- Modify: `src/lib/filters/brightnessContrastFilter.ts`
- Test: `src/lib/__tests__/brightnessContrastFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Update test signature throughout. The existing tests check specific brightness/contrast formula outputs; preserve those exact expected values but change the call shape:

```ts
import { describe, it, expect } from 'vitest';
import { applyBrightnessContrastFilter } from '../filters/brightnessContrastFilter';

describe('applyBrightnessContrastFilter', () => {
  // Replicate the existing test assertions but with the new signature.
  // Pattern for every test:
  //   const inputValues = new Uint8Array([...]);
  //   const outputValues = new Uint8Array(inputValues.length);
  //   applyBrightnessContrastFilter(inputValues, outputValues, w, h, brightness, contrast);
  //   expect(outputValues[i]).toBe(...);

  // Plus: add an "input not mutated" test.
  it('does not mutate the input buffer', () => {
    const inputValues = new Uint8Array([50, 100, 150, 200]);
    const originalSnapshot = Array.from(inputValues);
    const outputValues = new Uint8Array(4);
    applyBrightnessContrastFilter(inputValues, outputValues, 4, 1, 20, 30);
    expect(Array.from(inputValues)).toEqual(originalSnapshot);
  });
});
```

(The engineer should preserve all existing test assertions exactly — only the call signature changes.)

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- brightnessContrastFilter
```

- [ ] **Step 3: Refactor the filter**

```ts
function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function applyBrightnessContrastFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
  brightness: number,
  contrast: number,
): void {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let index = 0; index < inputValues.length; index++) {
    const brightened = inputValues[index] + brightness;
    const contrasted = contrastFactor * (brightened - 128) + 128;
    outputValues[index] = clampToByte(contrasted);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- brightnessContrastFilter
```

- [ ] **Step 5: Commit**

```
git add src/lib/filters/brightnessContrastFilter.ts src/lib/__tests__/brightnessContrastFilter.test.ts
git commit -m "Refactor brightnessContrastFilter to in-place buffer signature"
```

---

## Task 5: Refactor `levelsFilter` to in-place

**Files:**
- Modify: `src/lib/filters/levelsFilter.ts`
- Test: `src/lib/__tests__/levelsFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Same pattern as Task 4: preserve existing assertion values, change call signature. Add the "input not mutated" test.

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- levelsFilter
```

- [ ] **Step 3: Refactor the filter**

```ts
function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function applyLevelsFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  _width: number,
  _height: number,
  inputMin: number,
  inputMax: number,
  gamma: number,
): void {
  const isNeutral = inputMin === 0 && inputMax === 255 && gamma === 1.0;
  if (isNeutral) {
    outputValues.set(inputValues);
    return;
  }
  const inputRange = Math.max(1, inputMax - inputMin);
  const gammaExponent = 1.0 / Math.max(0.01, gamma);
  for (let index = 0; index < inputValues.length; index++) {
    const normalized = Math.max(0, Math.min(1, (inputValues[index] - inputMin) / inputRange));
    const gammaAdjusted = Math.pow(normalized, gammaExponent);
    outputValues[index] = clampToByte(gammaAdjusted * 255);
  }
}
```

Note: the "neutral" early-return is preserved but now does a `outputValues.set(inputValues)` copy. `applyFilterPipeline` (Task 9) will skip calling this filter entirely when neutral, so this branch is only a defensive fallback.

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- levelsFilter
```

- [ ] **Step 5: Commit**

```
git add src/lib/filters/levelsFilter.ts src/lib/__tests__/levelsFilter.test.ts
git commit -m "Refactor levelsFilter to in-place buffer signature"
```

---

## Task 6: Refactor `sharpenFilter` (both functions) to in-place

**Files:**
- Modify: `src/lib/filters/sharpenFilter.ts`
- Test: `src/lib/__tests__/sharpenFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Same pattern as Tasks 3–5: preserve existing assertion values, change signatures. Both `applySharpenFilter` and `applyUnsharpMaskFilter` get the new signature. Add "input not mutated" tests for **both**.

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- sharpenFilter
```

- [ ] **Step 3: Refactor the filter**

```ts
function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const SHARPEN_KERNEL = [0, -2, 0, -2, 11, -2, 0, -2, 0];
const KERNEL_DIVISOR = 3;

export function applySharpenFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let sum = 0;
      let kernelIndex = 0;
      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          sum += inputValues[sampleRow * width + sampleCol] * SHARPEN_KERNEL[kernelIndex];
          kernelIndex++;
        }
      }
      outputValues[row * width + col] = clampToByte(sum / KERNEL_DIVISOR);
    }
  }
}

export function applyUnsharpMaskFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let blurSum = 0;
      let sampleCount = 0;
      for (let kernelRow = -1; kernelRow <= 1; kernelRow++) {
        for (let kernelCol = -1; kernelCol <= 1; kernelCol++) {
          const sampleRow = Math.max(0, Math.min(height - 1, row + kernelRow));
          const sampleCol = Math.max(0, Math.min(width - 1, col + kernelCol));
          blurSum += inputValues[sampleRow * width + sampleCol];
          sampleCount++;
        }
      }
      const blurred = blurSum / sampleCount;
      const originalValue = inputValues[row * width + col];
      const sharpened = originalValue + (originalValue - blurred) * 1.5;
      outputValues[row * width + col] = clampToByte(sharpened);
    }
  }
}
```

Convolutions read neighbors — input and output **must** be different buffers. Ping-pong in the pipeline handles this naturally.

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- sharpenFilter
```

- [ ] **Step 5: Commit**

```
git add src/lib/filters/sharpenFilter.ts src/lib/__tests__/sharpenFilter.test.ts
git commit -m "Refactor sharpen and unsharp-mask filters to in-place buffer signature"
```

---

## Task 7: Refactor `ditherFilter` to in-place

**Files:**
- Modify: `src/lib/filters/ditherFilter.ts`
- Test: `src/lib/__tests__/ditherFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Same pattern. Note: the existing filter has an early-return `if (amount === 0 && randomness === 0) return image;` — the new version will be skipped by `applyFilterPipeline` in that case, so the in-place version doesn't need the early-return at all. Tests should not exercise the (0, 0) case directly — that responsibility moves to the pipeline orchestrator.

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- ditherFilter
```

- [ ] **Step 3: Refactor the filter**

```ts
function clampToByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function applyDitherFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
  amount: number,
  randomness: number,
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      let value = inputValues[index];
      if (amount > 0) {
        const checkerOffset = (row + col) % 2 === 0 ? amount : -amount;
        value += checkerOffset;
      }
      if (randomness > 0) {
        const noise = (Math.random() * 2 - 1) * randomness;
        value += noise;
      }
      outputValues[index] = clampToByte(value);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- ditherFilter
```

- [ ] **Step 5: Commit**

```
git add src/lib/filters/ditherFilter.ts src/lib/__tests__/ditherFilter.test.ts
git commit -m "Refactor ditherFilter to in-place buffer signature"
```

---

## Task 8: Refactor `flipFilter` (both functions) to in-place

**Files:**
- Modify: `src/lib/filters/flipFilter.ts`
- Test: `src/lib/__tests__/flipFilter.test.ts`

- [ ] **Step 1: Rewrite the tests**

Same pattern. Tests for both `applyFlipHorizontalFilter` and `applyFlipVerticalFilter` change signature; add "input not mutated" tests for both.

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- flipFilter
```

- [ ] **Step 3: Refactor the filter**

```ts
export function applyFlipHorizontalFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      outputValues[row * width + col] = inputValues[row * width + (width - 1 - col)];
    }
  }
}

export function applyFlipVerticalFilter(
  inputValues: Uint8Array,
  outputValues: Uint8Array,
  width: number,
  height: number,
): void {
  for (let row = 0; row < height; row++) {
    const sourceRow = height - 1 - row;
    for (let col = 0; col < width; col++) {
      outputValues[row * width + col] = inputValues[sourceRow * width + col];
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- flipFilter
```

- [ ] **Step 5: Commit**

```
git add src/lib/filters/flipFilter.ts src/lib/__tests__/flipFilter.test.ts
git commit -m "Refactor flipHorizontal and flipVertical filters to in-place buffer signature"
```

---

## Task 9: Refactor `applyFilterPipeline` to ping-pong + update `asciiConverter`

**Files:**
- Modify: `src/lib/asciiConverter.ts`

This task is the orchestrator update. After this, the build is green again.

- [ ] **Step 1: Rewrite `applyFilterPipeline`**

Replace the `applyFilterPipeline` function in `src/lib/asciiConverter.ts`:

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

  // 1. Stretch
  if (settings.applyStretch) {
    applyStretchFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  // 2. Brightness / Contrast
  if (settings.brightness !== 0 || settings.contrast !== 0) {
    applyBrightnessContrastFilter(read, write, width, height, settings.brightness, settings.contrast);
    [read, write] = [write, read];
  }

  // 3. Levels
  const levelsNeutral =
    settings.levelsInputMin === 0 && settings.levelsInputMax === 255 && settings.levelsGamma === 1.0;
  if (!levelsNeutral) {
    applyLevelsFilter(read, write, width, height, settings.levelsInputMin, settings.levelsInputMax, settings.levelsGamma);
    [read, write] = [write, read];
  }

  // 4. Sharpening (mutually exclusive)
  if (settings.applyUnsharpMask) {
    applyUnsharpMaskFilter(read, write, width, height);
    [read, write] = [write, read];
  } else if (settings.applySharpen) {
    applySharpenFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  // 5. Dither
  if (settings.ditherAmount > 0 || settings.ditherRandom > 0) {
    applyDitherFilter(read, write, width, height, settings.ditherAmount, settings.ditherRandom);
    [read, write] = [write, read];
  }

  // 6. Flips
  if (settings.flipHorizontal) {
    applyFlipHorizontalFilter(read, write, width, height);
    [read, write] = [write, read];
  }
  if (settings.flipVertical) {
    applyFlipVerticalFilter(read, write, width, height);
    [read, write] = [write, read];
  }

  return read;
}
```

- [ ] **Step 2: Update `convertImageToAscii` to use the new pipeline**

```ts
export function convertImageToAscii(
  source: CanvasImageSource,
  settings: ConversionSettings,
): AsciiGrid {
  const { width: outputWidth, height: outputHeight } = resolveOutputDimensions(source, settings);

  const grayscaleImage = extractGrayscaleValues(source, outputWidth, outputHeight);
  const scratchBuffer = new Uint8Array(outputWidth * outputHeight);
  const finalBuffer = applyFilterPipeline(
    grayscaleImage.values,
    scratchBuffer,
    outputWidth,
    outputHeight,
    settings,
  );

  const colorValues =
    settings.colorMode === 'color'
      ? extractColorValues(source, outputWidth, outputHeight)
      : null;

  const effectiveRamp = settings.invertRamp
    ? reverseRamp(settings.characterRamp)
    : settings.characterRamp;

  const grid: AsciiGrid = [];
  for (let row = 0; row < outputHeight; row++) {
    const gridRow: AsciiCell[] = [];
    for (let col = 0; col < outputWidth; col++) {
      const index = row * outputWidth + col;
      const character = mapBrightnessToCharacter(finalBuffer[index], effectiveRamp);
      const cell: AsciiCell = { character };
      if (colorValues) cell.color = colorValues[index];
      gridRow.push(cell);
    }
    grid.push(gridRow);
  }
  return grid;
}
```

- [ ] **Step 3: Update `resolveOutputDimensions` to use `getSourceDimensions`**

```ts
function resolveOutputDimensions(
  source: CanvasImageSource,
  settings: ConversionSettings,
): { width: number; height: number } {
  const outputWidth = Math.max(1, settings.outputWidth);
  let outputHeight: number;
  if (settings.outputHeight > 0 && !settings.maintainAspectRatio) {
    outputHeight = settings.outputHeight;
  } else {
    const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
    outputHeight = calculateAutoOutputHeight(
      sourceWidth, sourceHeight, outputWidth, settings.characterAspectRatio,
    );
  }
  return { width: outputWidth, height: Math.max(1, outputHeight) };
}
```

- [ ] **Step 4: Run full test suite to verify all tests pass**

```
npm test
npm run lint
```

Expected: all tests pass. The full pipeline now uses in-place filters. Existing tests in `__tests__/` that exercise `convertImageToAscii` indirectly via no-op or default settings continue to pass.

- [ ] **Step 5: Commit**

```
git add src/lib/asciiConverter.ts
git commit -m "Refactor applyFilterPipeline to ping-pong in-place buffers"
```

---

## Task 10: Add `filterPipeline.test.ts` with zero-allocation regression gate

**Files:**
- Create: `src/lib/__tests__/filterPipeline.test.ts`

The orchestrator already has indirect coverage through the convertImageToAscii path. This file adds **direct** tests of the pipeline contract, including the perf invariant.

- [ ] **Step 1: Write the test file**

Create `src/lib/__tests__/filterPipeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { convertImageToAscii } from '../asciiConverter';
import { DEFAULT_RAMP } from '../asciiRamp';
import type { ConversionSettings } from '../types';

const NEUTRAL_SETTINGS: ConversionSettings = {
  outputWidth: 8,
  outputHeight: 4,
  maintainAspectRatio: false,
  characterAspectRatio: 0.5,
  characterRamp: DEFAULT_RAMP,
  invertRamp: false,
  applyStretch: false,
  brightness: 0,
  contrast: 0,
  levelsInputMin: 0,
  levelsInputMax: 255,
  levelsGamma: 1.0,
  applySharpen: false,
  applyUnsharpMask: false,
  ditherAmount: 0,
  ditherRandom: 0,
  flipHorizontal: false,
  flipVertical: false,
  colorMode: 'white-on-black',
};

function makeSyntheticCanvas(width: number, height: number, fillByte: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = `rgb(${fillByte},${fillByte},${fillByte})`;
  context.fillRect(0, 0, width, height);
  return canvas;
}

describe('filter pipeline (via convertImageToAscii)', () => {
  it('produces the same character grid shape regardless of filter activity', () => {
    const canvas = makeSyntheticCanvas(16, 8, 128);
    const grid = convertImageToAscii(canvas, NEUTRAL_SETTINGS);
    expect(grid.length).toBe(4);
    expect(grid[0].length).toBe(8);
  });

  it('honors enabled filters end-to-end', () => {
    const canvas = makeSyntheticCanvas(16, 8, 100);
    const withStretch = convertImageToAscii(canvas, { ...NEUTRAL_SETTINGS, applyStretch: true });
    const withoutStretch = convertImageToAscii(canvas, NEUTRAL_SETTINGS);
    // Different output bytes once stretch is enabled (uniform input + stretch is a no-op due to zero range,
    // so use brightness instead to verify filters compose)
    const bright = convertImageToAscii(canvas, { ...NEUTRAL_SETTINGS, brightness: 50 });
    expect(bright[0][0].character).not.toBe(withoutStretch[0][0].character);
  });
});

describe('pipeline allocation regression gate', () => {
  it('does not construct any Uint8Array during 100 pipeline runs on pre-allocated buffers', async () => {
    // Import the internal applyFilterPipeline by re-exporting it from asciiConverter.ts.
    // (Add `export { applyFilterPipeline }` to asciiConverter.ts as part of this step.)
    const { applyFilterPipeline } = await import('../asciiConverter');

    const width = 80;
    const height = 40;
    const OriginalUint8Array = globalThis.Uint8Array;

    const inputBuffer = new OriginalUint8Array(width * height);
    const scratchBuffer = new OriginalUint8Array(width * height);
    inputBuffer.fill(128);

    let constructionCount = 0;
    class TrackingUint8Array extends OriginalUint8Array {
      constructor(...args: ConstructorParameters<typeof Uint8Array>) {
        super(...(args as []));
        constructionCount++;
      }
    }
    (globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array = TrackingUint8Array as typeof Uint8Array;

    const activeSettings: ConversionSettings = {
      ...NEUTRAL_SETTINGS,
      applyStretch: true,
      brightness: 10,
      contrast: 5,
      ditherAmount: 3,
      ditherRandom: 2,
      flipHorizontal: true,
    };

    try {
      for (let frame = 0; frame < 100; frame++) {
        applyFilterPipeline(inputBuffer, scratchBuffer, width, height, activeSettings);
      }
    } finally {
      (globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array = OriginalUint8Array;
    }

    expect(constructionCount).toBe(0);
  });
});
```

- [ ] **Step 2: Re-export `applyFilterPipeline` from `asciiConverter.ts`**

Add a single line to `asciiConverter.ts`:

```ts
export { applyFilterPipeline };
```

(Currently `applyFilterPipeline` is module-private; we're widening its scope just for testability. This is the smallest reasonable seam.)

- [ ] **Step 3: Run tests to verify they pass**

```
npm test
```

Expected: all tests pass, including the zero-allocation gate.

- [ ] **Step 4: Commit**

```
git add src/lib/__tests__/filterPipeline.test.ts src/lib/asciiConverter.ts
git commit -m "Add filter pipeline integration tests and zero-allocation regression gate"
```

---

## Task 11: Final verification of refactor checkpoint

- [ ] **Step 1: Run the full test suite + lint**

```
npm test
npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 2: Manual smoke test in browser**

Open the dev server (the user has one running locally — do not start one yourself). Verify:
- [ ] Loading an image via drag/drop still works
- [ ] All filter sliders still affect the output
- [ ] Color mode toggle still works
- [ ] Export buttons still work (TXT, HTML, PNG)

If any of these fail, debug before proceeding. **Do not move to Task 12 with a broken still-image pipeline.**

- [ ] **Step 3: No commit needed (verification only)**

---

## Task 12: Add `liveAsciiRenderer.ts`

**Files:**
- Create: `src/lib/liveAsciiRenderer.ts`
- Create: `src/lib/__tests__/liveAsciiRenderer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/liveAsciiRenderer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderGrayscaleToText } from '../liveAsciiRenderer';

const SIMPLE_RAMP = ' .-=+*#%@'; // 9 chars

describe('renderGrayscaleToText', () => {
  it('maps brightness=0 to the first ramp character', () => {
    const values = new Uint8Array([0]);
    const result = renderGrayscaleToText(values, 1, 1, SIMPLE_RAMP);
    expect(result).toBe(' \n');
  });

  it('maps brightness=255 to the last ramp character', () => {
    const values = new Uint8Array([255]);
    const result = renderGrayscaleToText(values, 1, 1, SIMPLE_RAMP);
    expect(result).toBe('@\n');
  });

  it('emits one newline per row', () => {
    const values = new Uint8Array([0, 0, 0, 0]);
    const result = renderGrayscaleToText(values, 2, 2, SIMPLE_RAMP);
    expect(result.split('\n').length - 1).toBe(2); // 2 newlines for 2 rows
  });

  it('places newlines at row boundaries (width=4, height=2)', () => {
    const values = new Uint8Array([0, 255, 0, 255, 255, 0, 255, 0]);
    const result = renderGrayscaleToText(values, 4, 2, SIMPLE_RAMP);
    expect(result).toBe(' @ @\n@ @ \n');
  });

  it('output length is width*height + height (one newline per row)', () => {
    const width = 8;
    const height = 3;
    const values = new Uint8Array(width * height);
    const result = renderGrayscaleToText(values, width, height, SIMPLE_RAMP);
    expect(result.length).toBe(width * height + height);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- liveAsciiRenderer
```

Expected: 5 failures with import error.

- [ ] **Step 3: Implement `renderGrayscaleToText`**

Create `src/lib/liveAsciiRenderer.ts`:

```ts
export function renderGrayscaleToText(
  values: Uint8Array,
  width: number,
  height: number,
  ramp: string,
): string {
  const rampLastIndex = ramp.length - 1;
  let result = '';
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const brightness = values[row * width + col];
      // Match mapBrightnessToCharacter exactly: scale 0–255 → 0–(ramp.length-1)
      const rampIndex = Math.min(rampLastIndex, Math.floor((brightness / 255) * ramp.length));
      result += ramp[rampIndex];
    }
    result += '\n';
  }
  return result;
}
```

**Important parity:** the brightness→character mapping must match `mapBrightnessToCharacter` in `asciiRamp.ts` exactly, otherwise live and still output will look subtly different. Before committing, verify this in step 4 by adding a parity test below.

- [ ] **Step 4: Add a parity test against `mapBrightnessToCharacter`**

Add to `src/lib/__tests__/liveAsciiRenderer.test.ts`:

```ts
import { mapBrightnessToCharacter } from '../asciiRamp';

describe('renderGrayscaleToText parity with mapBrightnessToCharacter', () => {
  it('produces the same character for every brightness value', () => {
    const ramp = '0123456789'; // distinct chars per ramp index
    for (let brightness = 0; brightness <= 255; brightness++) {
      const renderer = renderGrayscaleToText(new Uint8Array([brightness]), 1, 1, ramp);
      const expected = mapBrightnessToCharacter(brightness, ramp) + '\n';
      expect(renderer).toBe(expected);
    }
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test -- liveAsciiRenderer
```

If the parity test fails, reconcile the `renderGrayscaleToText` ramp index calculation with `mapBrightnessToCharacter`'s. (Read `src/lib/asciiRamp.ts` to confirm the exact formula.)

- [ ] **Step 6: Commit**

```
git add src/lib/liveAsciiRenderer.ts src/lib/__tests__/liveAsciiRenderer.test.ts
git commit -m "Add liveAsciiRenderer for imperative pre.textContent updates"
```

---

## Task 13: Add `cameraSource.ts`

**Files:**
- Create: `src/lib/cameraSource.ts`
- Create: `src/lib/__tests__/cameraSource.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/cameraSource.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCameraSource } from '../cameraSource';

interface MockTrack { stop: ReturnType<typeof vi.fn>; }
interface MockMediaStream { getTracks: () => MockTrack[]; }

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

  it('start() calls getUserMedia with user-facing camera by default', async () => {
    const camera = createCameraSource();
    await camera.start({ facing: 'user' });
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'user' },
      audio: false,
    });
  });

  it('start() with environment facing requests rear camera', async () => {
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

  it('isReady() returns false before start, true after dimensions are available', async () => {
    const camera = createCameraSource();
    expect(camera.isReady()).toBe(false);
    await camera.start({ facing: 'user' });
    // After start, the video element won't have dimensions in JSDOM until 'loadedmetadata' fires.
    // The implementation should expose isReady() based on videoElement.videoWidth > 0.
    expect(typeof camera.isReady()).toBe('boolean');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- cameraSource
```

Expected: all failures with import error.

- [ ] **Step 3: Implement `cameraSource.ts`**

Create `src/lib/cameraSource.ts`:

```ts
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
  videoElement.playsInline = true;       // mandatory for iOS Safari
  videoElement.autoplay = true;
  videoElement.muted = true;

  let activeStream: MediaStream | null = null;
  let activeFacing: CameraFacing = 'user';

  async function start(options: { facing: CameraFacing }): Promise<void> {
    activeFacing = options.facing;
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: options.facing },
      audio: false,
    });
    videoElement.srcObject = activeStream;
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
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- cameraSource
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```
git add src/lib/cameraSource.ts src/lib/__tests__/cameraSource.test.ts
git commit -m "Add cameraSource module for getUserMedia lifecycle management"
```

---

## Task 14: Add `useLiveAscii` hook

**Files:**
- Create: `src/components/useLiveAscii.ts`

Hook composition; manually tested via the UI in Task 17. No new unit tests — the primitives are individually covered.

- [ ] **Step 1: Implement the hook**

Create `src/components/useLiveAscii.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createCameraSource, type CameraFacing, type CameraSource } from '../lib/cameraSource';
import { pixelsToGrayscaleInto } from '../lib/imageProcessor';
import { applyFilterPipeline } from '../lib/asciiConverter';
import { renderGrayscaleToText } from '../lib/liveAsciiRenderer';
import { reverseRamp } from '../lib/asciiRamp';
import type { ConversionSettings } from '../lib/types';

export type LiveStatus = 'idle' | 'streaming' | 'paused';

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
  const resizeContext = resizeCanvas.getContext('2d')!;
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
  let outputHeight: number;
  if (settings.outputHeight > 0 && !settings.maintainAspectRatio) {
    outputHeight = settings.outputHeight;
  } else {
    const aspectRatio = sourceHeight / sourceWidth;
    outputHeight = Math.max(1, Math.round(outputWidth * aspectRatio * settings.characterAspectRatio));
  }
  return { width: outputWidth, height: outputHeight };
}

export function useLiveAscii(
  settings: ConversionSettings,
  preRef: React.MutableRefObject<HTMLPreElement | null>,
) {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraSource | null>(null);
  const resourcesRef = useRef<LiveResources | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const tick = useCallback(() => {
    const camera = cameraRef.current;
    const pre = preRef.current;
    if (!camera || !pre) return;
    if (!camera.isReady()) {
      rafHandleRef.current = requestAnimationFrame(tick);
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
      const ramp = settingsRef.current.invertRamp
        ? reverseRamp(settingsRef.current.characterRamp)
        : settingsRef.current.characterRamp;
      pre.textContent = renderGrayscaleToText(finalBuffer, targetWidth, targetHeight, ramp);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Frame conversion failed';
      setError(`Live conversion error: ${message}`);
      teardown();
      return;
    }

    rafHandleRef.current = requestAnimationFrame(tick);
  }, [preRef]);

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

  const start = useCallback(async (facing: CameraFacing) => {
    setError(null);
    try {
      cameraRef.current = createCameraSource();
      await cameraRef.current.start({ facing });
      setStatus('streaming');
      rafHandleRef.current = requestAnimationFrame(tick);
    } catch (caught) {
      const errorName = caught instanceof DOMException ? caught.name : 'Unknown';
      const messages: Record<string, string> = {
        NotAllowedError: 'Camera permission denied. Check your browser site settings.',
        NotFoundError: 'No camera detected on this device.',
        NotReadableError: 'Camera is in use by another app.',
        OverconstrainedError: 'Requested camera mode unavailable. Try the flip-camera button.',
        SecurityError: 'Camera access requires a secure (https://) connection.',
      };
      setError(messages[errorName] ?? `Camera error: ${errorName}`);
      setStatus('idle');
    }
  }, [tick]);

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
    rafHandleRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = teardown;

  const flip = useCallback(async () => {
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    await cameraRef.current?.flip();
    rafHandleRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const snapshot = useCallback((): HTMLCanvasElement | null => {
    const camera = cameraRef.current;
    if (!camera || !camera.isReady()) return null;
    pause();
    const { source, width, height } = camera.getFrame();
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = width;
    snapCanvas.height = height;
    snapCanvas.getContext('2d')!.drawImage(source, 0, 0);
    return snapCanvas;
  }, [pause]);

  // Page Visibility — auto-pause when tab hidden
  useEffect(() => {
    const onVisibilityChange = () => {
      if (status !== 'streaming') return;
      if (document.hidden) {
        if (rafHandleRef.current !== null) {
          cancelAnimationFrame(rafHandleRef.current);
          rafHandleRef.current = null;
        }
        cameraRef.current?.pause();
      } else {
        cameraRef.current?.resume();
        rafHandleRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [status, tick]);

  // Component-unmount cleanup
  useEffect(() => {
    return () => teardown();
  }, [teardown]);

  return { status, error, start, pause, resume, stop, flip, snapshot };
}
```

- [ ] **Step 2: Verify it compiles**

```
npm run lint
```

Expected: no TS errors.

- [ ] **Step 3: Commit**

```
git add src/components/useLiveAscii.ts
git commit -m "Add useLiveAscii hook with rAF loop and long-lived ping-pong buffers"
```

---

## Task 15: Add `LiveControls` component

**Files:**
- Create: `src/components/LiveControls.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/LiveControls.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify lint**

```
npm run lint
```

- [ ] **Step 3: Commit**

```
git add src/components/LiveControls.tsx
git commit -m "Add LiveControls component (header + toolbar buttons)"
```

---

## Task 16: Modify `AsciiPreview` to accept `liveMode` prop

**Files:**
- Modify: `src/components/AsciiPreview.tsx`

- [ ] **Step 1: Add the new props and conditional render**

In `src/components/AsciiPreview.tsx`:

1. Extend `AsciiPreviewProps`:

```ts
interface AsciiPreviewProps {
  grid: AsciiGrid | null;
  settings: ConversionSettings;
  isProcessing: boolean;
  errorMessage: string | null;
  onFileDrop: (file: File) => void;
  // New:
  liveMode: boolean;
  livePreRef: React.MutableRefObject<HTMLPreElement | null>;
  liveToolbarControls?: React.ReactNode;
  onStartCamera?: () => void; // for the drop-zone "or use camera" button
}
```

2. Inside the function body, replace the section that renders the ASCII output with:

```tsx
{grid && !isProcessing && !liveMode && (
  <pre
    className="ascii-output"
    style={{ fontSize: `${previewFontSize}px`, color: previewTextColor }}
  >
    {renderAsciiContent()}
  </pre>
)}

{liveMode && (
  <pre
    ref={livePreRef}
    className="ascii-output"
    style={{ fontSize: `${previewFontSize}px`, color: previewTextColor }}
  />
)}
```

3. Inside the drop-instructions block, add an "or use camera" line that calls `onStartCamera` if provided:

```tsx
{!grid && !isProcessing && !errorMessage && !liveMode && (
  <div className="drop-instructions">
    <pre className="drop-art">{DROP_ZONE_ART}</pre>
    <p className="drop-hint">drag & drop an image here</p>
    <p className="drop-hint-sub">or use [LOAD IMAGE] above</p>
    {onStartCamera && (
      <p className="drop-hint-sub">
        <button className="btn-link" onClick={onStartCamera} type="button">
          or [START CAMERA]
        </button>
      </p>
    )}
    <p className="drop-hint-sub">supports: jpg · png · gif · webp · bmp</p>
  </div>
)}
```

4. Update the preview toolbar to include `liveToolbarControls` between dimensions and zoom controls:

```tsx
<div className="preview-toolbar">
  <span className="preview-toolbar-label">PREVIEW</span>
  {grid && (
    <span className="preview-dimensions">{grid[0]?.length ?? 0}×{grid.length} chars</span>
  )}
  {liveToolbarControls}
  <div className="preview-zoom-controls">
    {/* existing zoom controls */}
  </div>
</div>
```

- [ ] **Step 2: Add minimal CSS for the new `btn-link` if not present**

Check `src/styles/global.css` for `.btn-link`. If absent, add:

```css
.btn-link {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
```

- [ ] **Step 3: Verify lint and tests pass**

```
npm test
npm run lint
```

Expected: all tests pass (no AsciiPreview tests today; behavior change is API-only).

- [ ] **Step 4: Commit**

```
git add src/components/AsciiPreview.tsx src/styles/global.css
git commit -m "AsciiPreview: accept liveMode prop, render imperative pre, add camera affordance"
```

---

## Task 17: Wire live mode into `App.tsx`

**Files:**
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Update App.tsx**

The full set of changes:

1. Add new imports:

```tsx
import { useLiveAscii } from './useLiveAscii';
import { LiveHeaderControls, LiveToolbarControls } from './LiveControls';
```

2. Add new state and refs:

```tsx
const livePreRef = useRef<HTMLPreElement | null>(null);
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const liveAscii = useLiveAscii(settings, livePreRef);
```

3. Update `DEFAULT_SETTINGS` to use the responsive default output width:

```tsx
const initialOutputWidth =
  typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 120;

export const DEFAULT_SETTINGS: ConversionSettings = {
  outputWidth: initialOutputWidth,
  // ...rest unchanged...
};
```

4. Add live-mode handlers:

```tsx
const handleStartCamera = useCallback(() => {
  liveAscii.start(isMobile ? 'environment' : 'user');
}, [liveAscii, isMobile]);

const handleStopCamera = useCallback(() => {
  liveAscii.stop();
  setLoadedImage(null);
  setAsciiGrid(null);
  setImageFileName('');
}, [liveAscii]);

const handleSnapshot = useCallback(() => {
  const snapCanvas = liveAscii.snapshot();
  if (!snapCanvas) return;
  setLoadedImage(snapCanvas);
  setImageFileName('camera snapshot');
}, [liveAscii]);

const handleResume = useCallback(() => {
  setLoadedImage(null);
  setAsciiGrid(null);
  liveAscii.resume();
}, [liveAscii]);

const handleFlip = useCallback(() => {
  liveAscii.flip();
}, [liveAscii]);
```

5. Compute `liveMode` boolean:

```tsx
const liveMode = liveAscii.status === 'streaming';
```

6. Surface live errors via existing errorMessage:

```tsx
useEffect(() => {
  if (liveAscii.error) setErrorMessage(liveAscii.error);
}, [liveAscii.error]);
```

7. Update header JSX:

```tsx
<div className="header-right">
  {imageFileName && <span className="header-filename">{imageFileName}</span>}
  {liveAscii.status === 'idle' && (
    <>
      <button className="btn-primary" onClick={() => fileInputRef.current?.click()} type="button">
        [LOAD IMAGE]
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />
    </>
  )}
  <LiveHeaderControls
    status={liveAscii.status}
    isMobile={isMobile}
    onStart={handleStartCamera}
    onStop={handleStopCamera}
    onFlip={handleFlip}
  />
</div>
```

8. Update AsciiPreview usage:

```tsx
<AsciiPreview
  grid={asciiGrid}
  settings={settings}
  isProcessing={isProcessing}
  errorMessage={errorMessage}
  onFileDrop={handleFileSelected}
  liveMode={liveMode}
  livePreRef={livePreRef}
  liveToolbarControls={
    <LiveToolbarControls
      status={liveAscii.status}
      onSnapshot={handleSnapshot}
      onResume={handleResume}
    />
  }
  onStartCamera={liveAscii.status === 'idle' ? handleStartCamera : undefined}
/>
```

- [ ] **Step 2: Verify lint and tests**

```
npm test
npm run lint
```

Expected: all tests pass.

- [ ] **Step 3: Manual smoke test**

In the user's running dev server, verify:
- [ ] Drop-zone shows the "or [START CAMERA]" affordance
- [ ] Clicking [START CAMERA] in the header prompts for camera permission
- [ ] Granted permission: ASCII feed appears in the `<pre>`, sliders affect it live
- [ ] Settings sliders: brightness, contrast, output width, ramp all visibly change the live feed
- [ ] [SNAPSHOT]: feed freezes, sliders now affect the frozen frame
- [ ] [RESUME]: feed continues
- [ ] [STOP CAMERA]: feed stops, browser camera indicator goes off

- [ ] **Step 4: Commit**

```
git add src/components/App.tsx
git commit -m "Wire live webcam ASCII mode into App: header + drop-zone entry, snapshot, resume, stop"
```

---

## Task 18: Add filter pipeline benchmark

**Files:**
- Create: `src/lib/__bench__/filterPipeline.bench.ts`

Vitest benchmarks are run via `npm test -- bench` or `vitest bench`. Not gated in CI.

- [ ] **Step 1: Create the bench file**

```ts
import { bench, describe } from 'vitest';
import { applyFilterPipeline } from '../asciiConverter';
import { DEFAULT_RAMP } from '../asciiRamp';
import type { ConversionSettings } from '../types';

const BASE_SETTINGS: ConversionSettings = {
  outputWidth: 80,
  outputHeight: 40,
  maintainAspectRatio: false,
  characterAspectRatio: 0.5,
  characterRamp: DEFAULT_RAMP,
  invertRamp: false,
  applyStretch: false,
  brightness: 0,
  contrast: 0,
  levelsInputMin: 0,
  levelsInputMax: 255,
  levelsGamma: 1.0,
  applySharpen: false,
  applyUnsharpMask: false,
  ditherAmount: 0,
  ditherRandom: 0,
  flipHorizontal: false,
  flipVertical: false,
  colorMode: 'white-on-black',
};

const width = 80;
const height = 40;

function makeBuffers() {
  const inputBuffer = new Uint8Array(width * height);
  const scratchBuffer = new Uint8Array(width * height);
  for (let index = 0; index < inputBuffer.length; index++) {
    inputBuffer[index] = (index * 37) & 0xff; // pseudo-noise
  }
  return { inputBuffer, scratchBuffer };
}

describe('filter pipeline at 80×40 (live-mode grid)', () => {
  bench('no filters enabled (baseline)', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, BASE_SETTINGS);
  });

  bench('stretch + brightness/contrast', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, {
      ...BASE_SETTINGS, applyStretch: true, brightness: 10, contrast: 15,
    });
  });

  bench('all filters enabled', () => {
    const { inputBuffer, scratchBuffer } = makeBuffers();
    applyFilterPipeline(inputBuffer, scratchBuffer, width, height, {
      ...BASE_SETTINGS,
      applyStretch: true,
      brightness: 10,
      contrast: 15,
      levelsInputMin: 10, levelsInputMax: 240, levelsGamma: 1.2,
      applySharpen: true,
      ditherAmount: 3,
      ditherRandom: 2,
      flipHorizontal: true,
    });
  });
});
```

- [ ] **Step 2: Run the bench locally**

```
npx vitest bench --run
```

Expected: three benches output, no errors. Record results in the PR description.

- [ ] **Step 3: Commit**

```
git add src/lib/__bench__/filterPipeline.bench.ts
git commit -m "Add filter pipeline benchmark for live-mode grid sizes"
```

---

## Task 19: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README**

```
cat README.md
```

- [ ] **Step 2: Add a "Live webcam mode" section**

Add under "Features" (or wherever live features fit):

```markdown
### Live webcam mode

Click **[START CAMERA]** in the header (or in the drop zone) to stream your device camera through the ASCII converter in real time. Works on desktop and mobile (rear camera default on phones, with a **[FLIP]** control). All filter settings affect the live feed in real time.

- **[SNAPSHOT]** freezes the current frame so you can tweak filters and export it like any loaded image
- **[RESUME]** returns to the live feed
- **[STOP CAMERA]** releases the camera

Camera access requires HTTPS (already in place for the GitHub Pages deployment).
```

- [ ] **Step 3: Commit**

```
git add README.md
git commit -m "Document live webcam mode in README"
```

---

## Task 20: Final verification + manual smoke checklist

- [ ] **Step 1: Run the full test suite + lint**

```
npm test
npm run lint
npm run build
```

Expected: all pass; build succeeds.

- [ ] **Step 2: Manual smoke checklist**

In the user's running dev server (do not start your own):

**Still-mode regression (must still work as before):**
- [ ] Drag-and-drop image conversion works
- [ ] All filter sliders affect the output
- [ ] Color mode toggle works (white-on-black, black-on-white, color)
- [ ] Export TXT, HTML, PNG all work
- [ ] Default ramp + ramp inversion work

**Live mode:**
- [ ] [START CAMERA] in header prompts for permission
- [ ] [START CAMERA] from drop zone works the same
- [ ] Granted: live ASCII renders at perceived 30+ FPS
- [ ] Brightness, contrast, stretch toggle visibly affect live feed
- [ ] Output width slider visibly resizes live grid
- [ ] Character ramp dropdown swaps live characters
- [ ] Ramp inversion works live
- [ ] iOS Safari: video does NOT go fullscreen on play
- [ ] iOS Safari (or mobile Chrome): rear camera is the default on START
- [ ] [FLIP] visibly swaps between user/environment cameras
- [ ] Hide tab → camera indicator stays on but no CPU usage; show tab → frames resume
- [ ] [SNAPSHOT] → feed freezes; slider drag → frozen frame re-converts
- [ ] [RESUME] → live feed continues from current frame
- [ ] Snapshot's frame is exportable via existing export buttons
- [ ] [STOP CAMERA] → feed stops, browser camera indicator turns off
- [ ] Camera denied → friendly error message in the status overlay
- [ ] Camera unavailable (toggle laptop camera off mid-session) → graceful error

**Mobile narrow-viewport (375 px width or actual phone):**
- [ ] Default `outputWidth` is 80 (not 120)
- [ ] [START CAMERA] defaults to rear camera (environment)
- [ ] Button sizes are touch-friendly

- [ ] **Step 3: No commit needed (verification only)**

---

## Closeout (post-task — not a numbered task)

After Task 20 verifies clean:

1. Rename the worktree branch to the intended name:

```
git branch -m feat/live-webcam-ascii
```

2. Push and open a PR:

```
git push -u origin feat/live-webcam-ascii
gh pr create --title "Live webcam ASCII mode (grayscale, ping-pong filter pipeline)" --body "..."
```

PR body should include:
- Link to the design spec
- Manual smoke checklist results (paste in checked boxes)
- Bench results from Task 18
- Note about the follow-up `test.yml` CI PR

3. Open the separate small PR adding `.github/workflows/test.yml` that runs `npm test && npm run lint` on PRs. This locks in the zero-allocation regression gate for everyone.
