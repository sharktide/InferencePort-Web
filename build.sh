#!/bin/bash
set -e

cd "$(dirname "$0")"

# Build the Next.js console app (static export)
cd console
npm install
npm run build
cd ..

# Assemble the dist directory
rm -rf dist
mkdir -p dist

# Copy root static files
for f in index.html pricing.html lightning.html marketplace.html solutions.html seniorband.html tools.html security.html shield.html install.html reset.html openapp.html authcallback.html robots.txt sitemap.xml CNAME LICENSE icon.png; do
  [ -f "$f" ] && cp "$f" dist/
done

# Copy root directories
for d in img styles components schemas scripts .well-known authcallback partnerships; do
  [ -d "$d" ] && cp -r "$d" dist/
done

# Copy Google verification file
cp googlec1c18fb443d3acae.html dist/ 2>/dev/null || true

# Copy Next.js static export into dist/console/
cp -r console/out/* dist/console/ 2>/dev/null || { mkdir -p dist/console && cp -r console/out/* dist/console/; }

echo "Build complete. Output in dist/"
