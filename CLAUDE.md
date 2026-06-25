# CLAUDE.md — working notes for AI assistants

Operating guide for refining this site. Read alongside `README.md` (which covers
structure and local dev). This file focuses on the non-obvious things and the
mistakes that are easy to make.

## What this is
Personal academic/portfolio site (Jekyll, academicpages → Minimal Mistakes fork)
deployed by **GitHub Pages from the `personal` branch** (classic build, no Actions).
Live at <https://rajdeshmukh1.github.io>.

## Preview and *visually* verify every change
There is no host Ruby — use the Docker image (build once: `docker build -t rajsite:dev .`):

```sh
docker run -d --name rajsite --network host -v "$(pwd)":/usr/src/app rajsite:dev \
  bundle exec jekyll serve --host localhost --port 4000 --watch     # http://localhost:4000
# one-off build instead (use this to verify a change compiles):
docker run --rm -v "$(pwd)":/usr/src/app rajsite:dev bundle exec jekyll build
```

- **`_config.yml` is NOT watched** — restart the container after editing it.
- **Always screenshot after visual/widget changes.** The widgets are `<canvas>`
  animations driven by `requestAnimationFrame`, so a screenshot is only meaningful
  after the animation has run. Use headless Chrome over the DevTools protocol:
  open the page, `sleep` a few seconds (let rAF settle / run any seek code), *then*
  capture. A plain "load + immediate screenshot" shows an empty canvas.

## Build / sanity check
`jekyll build` (above) must exit 0 with no Liquid/Sass errors. Removing an unused
file? Confirm the build is still clean and the affected pages still render — Jekyll
only errors on a *referenced* missing include/layout, so a clean build after a
deletion is the proof the file was truly dead.

## Git conventions
- Commit author for this repo: **`Raj Deshmukh <rajdeshmukh1@outlook.com>`**, and
  **no `Co-Authored-By` trailer**. Match the existing history.
- `personal` is the **live, pushed** branch. If you rewrite already-pushed commits
  (rebase/squash/fold), updating the remote needs `git push --force-with-lease`,
  which is a destructive outward action — **confirm with the user first** and keep
  a backup ref (`git branch backup-... HEAD`) before rewriting.

## Architecture you need to know
- **Layout defaults:** `_config.yml` `defaults` sets `layout: single` for `_pages`
  and `_publications`. Most pages therefore have *no* `layout:` in their front
  matter — do not assume `single.html`/`archive.html` are unused. The home page is
  `_pages/about.md` (`permalink: /`).
- **JS is split two ways:**
  - `assets/js/main.min.js` is a **pre-built, committed** bundle. Regenerate with
    `npm run build:js` (needs `npm install` first; `package.json` uses `uglify-js`)
    from `assets/js/_main.js` + `assets/js/plugins/*`. GitHub Pages does **not** run
    npm, so the built file must be committed.
  - `assets/js/theme.js` and the widgets are loaded raw via `_includes/scripts.html`.
- **SCSS:** the import graph is rooted at `assets/css/main.scss`. A file under
  `_sass/` is only live if it's reachable through that `@import` chain (it pulls in
  vendor frameworks: susy, breakpoint, font-awesome, magnific-popup). Trace the
  chain before deleting any `_sass/` file.
- **SEO lives in `_includes/seo.html`** (Open Graph, Twitter, canonical, JSON-LD),
  included from `head.html`. It has nothing to do with analytics.

## The interactive widgets (`assets/js/`)
Real algorithms rendered on canvas — refine carefully and re-screenshot:
- `imm-widget.js` — distributed multi-sensor tracking: per-node IMM banks feeding an
  Optimal Kalman Consensus Filter; the mahogany line is a node's own distributed
  estimate (local IMM + consensus pull toward neighbours), not a central fuser.
- `atc-widget.js` — terminal-airspace anomaly/precursor monitor with a scrubber and a
  fixed-size verdict box (sized to avoid layout jitter as text changes).
- `lane-widget.js` — perception: a clothoid lane Kalman filter and radar+camera object
  fusion shown in two geometrically-consistent views (forward camera ‖ bird's-eye).
  Covariance ellipses are mapped to *screen* axes (range→vertical, lateral→horizontal).

## Gotchas / lessons learned
- The theme ships a lot of **dead scaffolding**. A full dead-file audit was done and
  the unused pieces were removed (extra layouts, comments + analytics subsystems,
  Font Awesome v4/regular set, the Susy v1 `susyone` tree, orphan includes/JS/CSS).
  If you re-import the theme, expect that cruft to come back.
- **Comments and analytics are intentionally removed.** Re-enabling means restoring
  the provider include(s) + the `{% include %}` in `single.html`/`scripts.html` and
  setting the provider in `_config.yml`.
- `_data/ui-text.yml` was trimmed to the `en`/`en-US` blocks (site `locale` is
  `en-US`); the other ~40 language blocks were unused.
- Known minor cosmetic bug: the read-time meta uses the Font Awesome **v4** class
  `fa-clock-o` (in `page__hero.html`, `archive-single.html`, `single.html`) with no
  v4 shim loaded, so that clock glyph renders blank. Fix = switch to v6 `fa-clock`
  (`<i class="fas fa-clock">`). Read-time isn't currently enabled on any page.
- **Do not delete media** under `images/` or `files/` — assume any of it may be
  reused, even if currently unreferenced.

## Common tasks → where to edit
- Page copy: `_pages/*.md`.  Header nav: `_data/navigation.yml`.
- Colors / dark mode / polish: `_sass/_theme.scss` (loaded last) and `theme.js`.
- A widget: the matching `assets/js/*-widget.js`, plus its `<figure>`/`<canvas>`
  markup in the page (`research.md` / `work.md`).
- Site config (title, author, SEO defaults, collections, excludes): `_config.yml`
  (restart the preview container after).
