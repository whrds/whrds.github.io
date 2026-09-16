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

## GitHub Pages

Use the repository name `whrds.github.io`. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select **main** and **/docs**.

