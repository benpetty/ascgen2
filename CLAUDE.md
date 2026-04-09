# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server at localhost:4321
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

No test suite or linter is configured.

## Architecture

**Astro + React SPA** — Astro is used purely as a build wrapper. The single page (`src/pages/index.astro`) mounts the React `<App>` component with `client:only="react"`, so the entire application is client-side React. The build output is fully static.

**Deployment:** GitHub Pages at `https://benpetty.github.io/ascgen2/`. The `base: '/ascgen2'` in `astro.config.mjs` is required for asset paths to resolve correctly. CI runs via `.github/workflows/deploy.yml` on push to `main`.

**Core data flow:**

```
File/drop → loadImageFromFile() → HTMLImageElement
                                        ↓
                            extractGrayscaleValues()   ← resizes via canvas
                                        ↓
                            applyFilterPipeline()      ← 6 sequential filters
                                        ↓
                            mapBrightnessToCharacter() ← brightness → ramp index
                                        ↓
                                   AsciiGrid           ← AsciiCell[][]
                                        ↓
                    ┌───────────────────┼──────────────────┐
                AsciiPreview      textExporter       htmlExporter / imageExporter
                 (<pre> + spans)    (.txt / clipboard)   (.html / .png via canvas)
```

**Filter pipeline** (`src/lib/asciiConverter.ts`) applies in this exact order:
1. Stretch (normalize to 0–255)
2. Brightness/Contrast
3. Levels (input range + gamma)
4. Sharpen OR Unsharp Mask (mutually exclusive)
5. Dither (checkerboard + random noise)
6. Flip (horizontal/vertical)

**Character ramp** (`src/lib/asciiRamp.ts`): a string ordered dark→light. Brightness value (0–255) indexes into the ramp proportionally. Inverting the ramp reverses the string. The default ramp replicates the one from the original Ascgen2 C# application.

**Color mode:** When `colorMode === 'color'`, `extractColorValues()` runs a second canvas pass at the same target dimensions to sample the source image's RGB per cell. Color is stored on each `AsciiCell` and applied as inline `style` on the rendered spans, and embedded in HTML/PNG exports.

**State** lives entirely in `App.tsx`. Settings changes are debounced 80ms before re-running conversion to avoid thrashing during slider drags. The `HTMLImageElement` is kept in state so reconversion on settings change doesn't require re-reading the file.
