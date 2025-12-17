# InferencePort-Web

This folder contains a small static website for InferencePort AI (InferencePort-Web).

What I added
- `serve.js` — a tiny Node static server to preview the site locally (serves files from the repo root and falls back to `index.html`).
- `package.json` — includes a `start` script so you can run the local server with `npm start`.

Quick preview (PowerShell)

1. Make sure you have Node.js installed (node >= 14).
2. From the repository root run:

```powershell
# start the tiny server
npm start
# or directly (no npm):
node .\serve.js
```

Open http://localhost:8080 in your browser. The server serves static files and will fall back to `index.html` if a requested file isn't found (handy for single-page sites).

Alternative previews
- Python 3: `python -m http.server 8080` (runs in the current directory)
- Use GitHub Pages by pushing this repository to GitHub and enabling Pages on the `main` branch (select `/ (root)` as site source).

Notes
- The site files (HTML, CSS, images) are already present in this folder: `index.html`, `install.html`, `playground.html`, `security.html`, and `styles/`.
- If you want a different port: set the `PORT` environment variable, e.g. in PowerShell: `$env:PORT=3000; npm start`.
