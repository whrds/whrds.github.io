# whrds.log

A bilingual Korean/English security research blog for GitHub Pages.

## Local preview

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

## Add a bilingual post

Create two files with the same `translation_key`:

```text
content/ko/post-slug.md
content/en/post-slug.md
```

Each file uses this front matter:

```yaml
---
title: "Post title"
description: "Short description"
date: "2026-09-16"
translation_key: "post-slug"
tags: ["Tag one", "Tag two"]
---
```

Run `npm run build` before committing. GitHub Pages publishes the generated `docs/` directory from the `main` branch.

## Interactive hardware hero

The homepage has four original procedural Three.js hardware studies: a detailed PCB,
a memory module, an SPI firmware chip and a four-bay NAS. Select a study with the
numbered buttons; each has its own exploded view. Arrow keys move between model buttons.
`frontend/hero3d.js` owns the renderer and board; `frontend/hardware-models.js` builds
the other studies. Models are created on first selection, cached and disposed on exit.
Only the active model is rendered. These are illustrations, not schematics or exact
specifications of real products. No remote model or CDN is needed.
`npm run build` bundles the scene with esbuild and includes the Three.js license.
Only the homepage loads the 3D bundle. Rendering pauses offscreen and in hidden tabs;
auto-rotation defaults off on mobile and with reduced-motion preferences. Data Saver
keeps the static preview until the viewer opts in. WebGL failure keeps the preview and posts usable.

To run browser smoke tests with a locally installed Chrome:

```bash
npm run dev
# In a second terminal (use your preview port):
PREVIEW_URL=http://127.0.0.1:4173 node scripts/verify-hero.mjs
```

On PowerShell, set `$env:PREVIEW_URL='http://127.0.0.1:4173'` before running the script.
The optional `--poster` flag regenerates `static/hardware-poster.png` from the actual model.
Rebuild after regenerating the poster. Temporary QA screenshots are saved outside the repository.

## GitHub Pages

Use the repository name `whrds.github.io`. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select **main** and **/docs**.
