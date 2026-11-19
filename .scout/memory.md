# InferencePort-Web

## Overview

Static marketing site for InferencePort AI at https://inferenceport.ai. Root `*.html` pages are the source of truth. `console/` is a Next.js app exported to `dist/console/` by the build.

## Commands

- Build/deploy output: `pwsh ./build.ps1` or `bash build.sh` (both assemble `dist/`; `dist/` is gitignored).
- Console only: `cd console && npm run build` (static export in `console/out`).
- No root lint/typecheck scripts. Console has `npm run build` and tests under `console/tests`.

## Conventions

- Public pages live at repo root: `index.html`, `platform.html`, `ipx.html`, `install.html`, `lightning.html`, `marketplace.html`, `pricing.html`, `security.html`, `shield.html`, `tools.html`, `decision.html`, `partnerships/pollinations.html`.
- SEO files at root: `robots.txt`, `sitemap.xml`, `llms.txt`.
- New root static files must be added to the copy lists in BOTH `build.ps1` and `build.sh` or they will not deploy.
- `sitemap.xml` uses canonical `https://inferenceport.ai/...` URLs and git commit dates for `lastmod`; exclude transactional pages and `/console`.
- `robots.txt` disallows auth/transactional routes, `/console`, verification files, and repo/config files.

## Decisions

- `solutions.html` is not a source page; Vercel redirects `/solutions.html` and `/solutions` to `/platform.html`. A stale `dist/solutions.html` can exist from old builds.
- `llms.txt` follows the llms.txt spec: H1, blockquote summary, then H2 link sections.

## Pitfalls

- `dist/` is generated and may contain stale pages; never treat it as source.
- Some pages (`marketplace.html`, `pricing.html`, `shield.html`, `tools.html`) lack meta descriptions/robots tags; do not infer noindex from that.
- `vercel.json` rewrites `/console` to `/console/` and serves the console static export.

## Open threads

- None.

## Map

- `components/ip-navbar.js`, `components/ip-footer.js`: shared nav/footer.
- `scripts/`: site JS.
- `styles/`: shared CSS.
- `console/src/app/`: Next.js console routes.
- `build.ps1`, `build.sh`, `vercel.json`: build/deploy config.
