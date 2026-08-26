# Contributing

The site is plain GitHub Pages. There is no build step, no dependencies and no
CI — drop a file in, and the page exists.

## Adding a guide

1. Create `guides/<slug>.md` with front matter:

   ```yaml
   ---
   layout: default
   title: Your guide title
   ---
   ```

2. Add a row to the list in `index.md`.

That's it. Markdown, tables and code fences all render.

## Adding a stand

A stand is a raw `.html` file in `stands/` with **no front matter**, so Jekyll
copies it through untouched. Link `../assets/site.css` and `../assets/stand.css`,
and `../assets/stand.js` at the end of the body.

Conventions worth keeping:

- **Every tunable is a CSS custom property on `:root`**, driven by the control
  panel. One source of truth, all frames re-lay-out together.
- **A pattern that needs no script gets no script.** If a frame has a scroll
  listener, that listener is part of the claim being made.
- **Debug mode shows the real numbers.** Threshold overlays are positioned from
  the same custom properties the pattern reads, so a wrong line means a wrong
  implementation — not a wrong overlay.
- **No external assets.** No CDN, no remote fonts, no images. Placeholder
  gradients over stock photography.
- **State the placeholder palette.** `--surface-*` in `assets/stand.css` is a
  stand-in; say so on the page rather than implying these are the real tokens.

## Running it locally

```bash
python3 -m http.server 8787
```

Stands work as-is. Markdown guides need Jekyll if you want to preview their
rendering:

```bash
bundle exec jekyll serve
```

## What belongs here

Behavioural rules — scroll, motion, pinning, surfaces, gesture contracts — the
things a static mockup cannot carry, and that get re-litigated on every screen
until they are written down once.

What does not: component visual specs (those live in the design file), and
anything internal — endpoints, credentials, or internal file structure. This
repository is public.
