# ascgen2 — ASCII Generator 2 (Web Edition)

[![Deploy to GitHub Pages](https://github.com/benpetty/ascgen2/actions/workflows/deploy.yml/badge.svg)](https://github.com/benpetty/ascgen2/actions/workflows/deploy.yml)
[![Live](https://img.shields.io/badge/live-benpetty.github.io%2Fascgen2-blue)](https://benpetty.github.io/ascgen2/)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro-ff5d01)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

A browser-based port of the original [ASCII Generator 2](https://ascgendotnet.jmsoftware.co.uk) by Jonathan Mathews. Convert images to ASCII art with real-time preview and multiple export formats — no install, no backend, runs entirely in the browser.

**Live:** https://benpetty.github.io/ascgen2/

## Features

- Drag & drop or load any image (JPG, PNG, GIF, WebP, BMP)
- Real-time ASCII preview with zoom controls
- **Live webcam mode** — stream your camera through the converter in real time (see below)
- Full image processing pipeline: stretch, brightness, contrast, levels, sharpen, unsharp mask, dither, flip
- 6 character ramp presets + fully editable custom ramp
- Color output mode — per-character RGB sampled from the source image
- Export as `.txt`, `.html`, `.png`, or copy to clipboard

### Live webcam mode

Click **[START CAMERA]** in the header (or the **or [START CAMERA]** affordance in the drop zone) to stream your device camera through the ASCII converter in real time. Works on desktop and mobile (rear camera default on phones, with a **[FLIP]** control to switch). All filter sliders take effect on the live feed instantly.

- **[SNAPSHOT]** freezes the current frame so you can fine-tune filters and export the captured frame like any loaded image
- **[RESUME]** returns to streaming from the live camera
- **[STOP CAMERA]** releases the camera (browser indicator turns off)

Camera access requires a secure (HTTPS) connection — the GitHub Pages deployment satisfies this automatically. Live mode renders in grayscale at ~60 FPS on a typical laptop; color sampling is reserved for still images.

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # production build → dist/
npm run preview   # preview the build locally
```

## Credits

This project is a web reimplementation of **ASCII Generator 2**, originally written in C# by Jonathan Mathews.

- Original project: https://ascgendotnet.jmsoftware.co.uk
- The image processing pipeline, filter parameters, and default character ramp are based directly on the original Ascgen2 source code.

## Built With

- [Astro](https://astro.build)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
