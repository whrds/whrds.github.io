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
Drag with one finger inside the 3D canvas to orbit on mobile; swipe outside it to scroll.
The auto-rotation button starts a continuous turn (one revolution in 24 seconds),
and changes to a stop button while active. Manual dragging pauses auto-rotation.

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

## Subscription, image viewer, and view counts

The header and article footer offer RSS subscription in Korean or English.
The dialog copies the selected feed URL and can open Inoreader; no email address
or account is collected by the blog. RSS discovery links are included in each page.

Click an article image to open the keyboard-accessible viewer. Use Zoom in / Fit
to screen for large diagrams, and Escape or the close button to return to the post.
Ordinary image dragging, image/code context menus, and copying selected code are
restricted. These are UI deterrents only: public HTML, code and image files remain
accessible through developer tools, HTTP requests, screenshots, or disabled JavaScript.
Feed URLs and normal prose can still be copied.

View-count rendering and the client are prepared, but external collection is
disabled in `site-features.json`: `enabled: false`, `endpoint: null`.
The deployed pages make no counter-service requests while this is disabled.
Enabling a provider requires the owner's explicit approval of the provider and
visitor information transmitted, plus a matching on-site privacy explanation.
The prepared client uses JSON over HTTPS, sends no cookies or additional visitor
identifier, omits the browser referrer, and strips query strings and fragments from
the counted page. The network provider still receives the connection IP.
Korean and English posts share a key based on `translation_key`. Repeat views in
the same tab are reduced within 30 minutes when sessionStorage is available.
Counts begin at activation and do not reconstruct historical visits. They are
approximate; blockers and network failures may cause undercounting. Previews do
not record visits, and failures display an unavailable state instead of a fake zero.

Run `node --test scripts/site-tools.test.mjs` after `npm run build` to check the
feed, generated markup and counter contract without sending any analytics traffic.
