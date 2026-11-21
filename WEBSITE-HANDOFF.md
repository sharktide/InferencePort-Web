# Website refresh: resume here

## Checkpoint — November 18, 2026

The user asked for a new branch, a website upgrade, and six badges. **All six logo assets are saved locally; no badges are rendered yet.**

- Repository: `A:\InferencePort-Web`. New local branch: `feat/next-level-site-and-badges`, created from `main` at `1c44c89`. The older branch named `badges` is unrelated console work.
- `img/brands/reygrid.png` is already in the working tree. It is the 500 × 500 PNG (61,070 bytes) served as the logo in ReyGrid’s header. Its dimensions were checked; it has not been visually reviewed on our site.
- This handoff and the assets are untracked local files. Nothing was committed, pushed, or deployed. Keep the working tree when resuming. `.scout/memory.md` was already untracked before this task; leave it alone.
- Baseline: `node --test tests/site-theme.test.cjs tests/marketing-sections.test.cjs` passed all 45 tests before implementation. Playwright was not installed at the repository root; browser tests have not run.

## 1. Local marks (ready for layout)

`img/brands/` contains `pollinations.svg`, `tomdacat.svg`, `reygrid.png`, `openrouter.svg`, `microsoft.svg`, and `e2b.svg`. All five SVGs parsed as SVG documents and the PNG decoded successfully. OpenRouter and E2B paths were extracted from their homepage SVGs; these and the Microsoft symbol are organization logos to pair with explicit program names.

| Relationship / visible name | Asset source and next action |
| --- | --- |
| Customer: Pollinations.ai | `https://ai.tomdacat.com/pollinations-logo.svg` serves a complete horizontal Pollinations.ai wordmark. Prefer a matching first-party asset if available. Fit the full wordmark at its native proportions rather than squeezing it into a square. Link to `https://pollinations.ai/`. |
| Customer: TomdacatAI | `https://ai.tomdacat.com/icon.svg` is the first-party cat mark. Its SVG switches fill based on OS theme; use a controlled contrasting surface or a theme-aware mask so the site’s manual toggle also works. Label/link `ai.tomdacat.com`. |
| Customer: ReyGrid | Use the existing `img/brands/reygrid.png` from `https://reygrid.com/icon.png`; pair it with “ReyGrid” and link to `https://reygrid.com/`. |
| Member: OpenRouter for Startups | The first-party HTML at `https://openrouter.ai/` contains a header SVG labeled `OpenRouter` (`viewBox="19.82 17.199 365.556 258.298"`). Request HTML if the server returns the agent-oriented text version. Extract the mark; `/favicon.svg` returned 404. |
| Member: Microsoft for Startups | Four-color symbol from `https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg`. Preserve its colors and clear space. |
| Member: E2B for Startups | The header at `https://e2b.dev/` has an E2B wordmark (`viewBox="15 15 104 30"`) with separate light/dark path groups. Use one appropriate variant at a time. `/favicon.svg` returned 404. |

Record final source URLs alongside the assets. Verify the three **program landing URLs** before linking; organization homepages and marks were researched, program URLs were not. The membership statements come from the user. Label them as memberships rather than customers, investors, or endorsements.

## 2. Make the six badges visible and useful

1. In `index.html`, add a compact band inside `.lp-hero > .lp-wrap`, between `.lp-hero-grid` and `.lp-hero-demo`. This places customers near the introduction and preserves the quickstart and the existing homepage section structure. Give the band a stable anchor such as `#customers`.
2. Use two explicitly labeled lists: **Our customers** and **Startup programs we’re members of**. Give each badge a normal link with an accessible name. If adjacent text already supplies the name, use `alt=""` on the image; if a wordmark is the only label, give it meaningful alt text. The badges should work without JavaScript.
3. Add a contextual link to the existing `partnerships/pollinations.html` story. It describes the text-to-3D collaboration and gives visitors something more useful than a logo alone. Do not invent customer testimonials or usage figures for the other teams.
4. Style the band in `styles/landing.css` with the existing `--ink`, `--surface`, `--border`, and `--text-muted` tokens from `styles/shared.css`. Allow natural wordmark widths, wrap on narrow screens, and provide visible keyboard focus. Preview both manual themes, especially the black wordmarks. A static strip is sufficient; the hero already has an animated architecture map.
5. In `components/ip-footer.js`, add compact startup membership recognition using the same assets and exact program names. Use root-relative asset paths so nested pages work. Put reusable footer styling in `styles/shared.css` and check its fixed dark background. A Company link to `/index.html#customers` can make the customer band discoverable site-wide.

## 3. Broader polish proposed before the pause

These are follow-on ideas for the open-ended website upgrade, not prerequisites for the six badges. Finish and verify the badge experience first.

- **Quickstart language selector:** retain the existing Text / Image / Embeddings tabs and their working cURL snippets. Add a language control for SDK examples using the same base URL, model IDs, and environment-variable key. Copy the currently visible example; clear stale “Copied” feedback when switching examples. Keep cURL available without JavaScript.
- **Shield scenario selector:** allow visitors to compare a small set of illustrative request/response examples within the existing `#shield` preview. Keep example data local, switch signals, reasons, decision and recommended action together, and preserve the current labeled static example as the fallback.
- **Visual polish:** review spacing, typography, focus states and contrast around the hero-to-quickstart transition. If adding reveal effects, keep content visible without JavaScript and under reduced motion. `styles/landing.css` already has several later responsive overrides; inspect the effective style before adding another one.

## 4. Verify and hand back

- Start with `git status --short --branch`. Work in the source tree, not `dist/`. `build.sh` already copies `img/`, `styles/`, `components/`, `scripts/`, and `partnerships/` into the static deployment. No console or database changes are required for the badges.
- Serve the root with `python -m http.server 4173 --bind 127.0.0.1`. Open `http://127.0.0.1:4173/` and a nested page such as `/partnerships/pollinations.html`. Check all six names, actual image loads, destinations, and keyboard focus. At phone and desktop widths in both themes, confirm that no mark is cropped or invisible and that customers and memberships are unmistakable.
- Add focused coverage to `tests/marketing-sections.test.cjs` for correct grouping, links, and presence of local assets. Keep existing tests for anchors, the 12-product directory, quickstart examples, and theme behavior passing. Re-run `node --test tests/site-theme.test.cjs tests/marketing-sections.test.cjs`.
- If implementing interactive polish, exercise selection, keyboard access, copy behavior, and static fallbacks in a browser. `.github/workflows/home-topology-browser.yml` documents the pinned Playwright setup and `node tests/home-topology-browser.cjs`; the browser suite also checks mobile layout, reduced motion and horizontal overflow. Keep test screenshots and temporary dependencies out of the change set.
- Review `git diff --check` and the final status. Report which upgrades were completed and which checks actually ran. Commit or push only if requested.

**First action on resume:** assemble the two labeled badge groups from the six local assets (step 2).
