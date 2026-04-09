# ascgen2 — ASCII Generator 2 (Web Edition)

A browser-based port of the original [ASCII Generator 2](https://github.com/jason-jxc/Ascii-Generator-2) by Jason Champion. Convert images to ASCII art with real-time preview and multiple export formats — no install, no backend, runs entirely in the browser.

**Live:** https://benpetty.github.io/ascgen2/

## Features

- Drag & drop or load any image (JPG, PNG, GIF, WebP, BMP)
- Real-time ASCII preview with zoom controls
- Full image processing pipeline: stretch, brightness, contrast, levels, sharpen, unsharp mask, dither, flip
- 6 character ramp presets + fully editable custom ramp
- Color output mode — per-character RGB sampled from the source image
- Export as `.txt`, `.html`, `.png`, or copy to clipboard

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # production build → dist/
npm run preview   # preview the build locally
```

## Credits

This project is a web reimplementation of **ASCII Generator 2**, originally written in C# by Jason Champion.

- Original project: https://github.com/jason-jxc/Ascii-Generator-2
- The image processing pipeline, filter parameters, and default character ramp are based directly on the original Ascgen2 source code.

## Built With

- [Astro](https://astro.build)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
