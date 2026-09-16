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

Run `npm run build` before committing when you want to inspect the generated `docs/` output locally. GitHub Actions also rebuilds and deploys the site on every push to `main`.

## GitHub Pages

Use the repository name `whrds.github.io`. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.

