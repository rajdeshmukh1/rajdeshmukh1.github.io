# rajdeshmukh1.github.io

Personal academic / portfolio site for **Raj Deshmukh** — <https://rajdeshmukh1.github.io>.

Built with [Jekyll](https://jekyllrb.com/) on a fork of the
[academicpages](https://github.com/academicpages/academicpages.github.io) theme
(itself a fork of [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes)).
Mahogany accent, light default with a dark-mode toggle.

## Deploy

The site is served by **GitHub Pages** straight from the **`personal`** branch
(classic Pages build — no GitHub Actions). Pushing to `personal` triggers a
rebuild; there is no separate build step on GitHub's side, so any generated
assets that aren't produced by Jekyll (see `main.min.js` below) must be committed.

## Local development

A `Dockerfile` provides a self-contained Ruby/Jekyll environment, so no host Ruby
is needed:

```sh
docker build -t rajsite:dev .                 # once
docker run -d --name rajsite --network host \
  -v "$(pwd)":/usr/src/app rajsite:dev \
  bundle exec jekyll serve --host localhost --port 4000 --watch
# -> http://localhost:4000   (live-reloads on file changes)
```

`jekyll serve --watch` does **not** watch `_config.yml` — restart the container
after editing it. To produce a one-off build instead of serving:
`docker run --rm -v "$(pwd)":/usr/src/app rajsite:dev bundle exec jekyll build`.

## Layout

```
_pages/            about.md (home, /), research.md, work.md, publications.html, cv.md, 404.md
_publications/     publication entries (rendered on /publications/)
_layouts/          default <- compress; single (default for pages); archive
_includes/         theme partials (head, masthead, footer, seo, author-profile, ...)
_sass/             styles; assets/css/main.scss is the import entry point
_data/             navigation.yml (header nav), ui-text.yml (UI strings)
assets/js/         main.min.js (theme bundle) + theme.js + the interactive widgets
images/  files/    media and the CV PDF (/files/CV.pdf)
```

Page layout defaults (e.g. `layout: single`) are set in `_config.yml` under
`defaults`, so most pages have no `layout:` in their own front matter.

### JavaScript

- `assets/js/main.min.js` is the **pre-built** theme bundle. It is regenerated
  from `assets/js/_main.js` + plugins via `npm run build:js` (see `package.json`,
  uses `uglify-js`) and the output is committed.
- `assets/js/theme.js` powers the light/dark toggle and polish.
- The interactive **canvas widgets** are hand-written and loaded raw via
  `_includes/scripts.html`:
  - `imm-widget.js` — distributed multi-sensor estimation (IMM → Optimal Kalman
    Consensus Filter), on the Research page.
  - `atc-widget.js` — air-traffic anomaly / precursor monitor, on the Research page.
  - `lane-widget.js` — perception demo (lane Kalman filter + multi-sensor object
    fusion, dual camera/bird's-eye views), on the Work page.

## CV

The `/cv/` page embeds `files/CV.pdf`. The LaTeX source for the CV is maintained
separately (on Overleaf), not in this repo.
