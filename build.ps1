$ErrorActionPreference = "Stop"

# Set location to the script's directory
Set-Location $PSScriptRoot

# Build the Next.js console app (static export)
Push-Location console
npm install
npm run build
Pop-Location

# Assemble the dist directory
if (Test-Path dist) {
    Remove-Item -Recurse -Force dist
}
New-Item -ItemType Directory -Force -Path dist | Out-Null

# Copy root static files
$files = @(
    "index.html", "pricing.html", "lightning.html", "marketplace.html", 
    "redirect.html", "solutions.html", "seniorband.html", "tools.html", 
    "security.html", "shield.html", "install.html", "reset.html", 
    "openapp.html", "authcallback.html", "robots.txt", "sitemap.xml", 
    "CNAME", "LICENSE", "icon.png"
)

foreach ($f in $files) {
    if (Test-Path $f -PathType Leaf) {
        Copy-Item $f dist/
    }
}

# Copy root directories
$dirs = @("img", "styles", "components", "schemas", "scripts", ".well-known", "authcallback", "partnerships")

foreach ($d in $dirs) {
    if (Test-Path $d -PathType Container) {
        Copy-Item -Recurse $d dist/
    }
}

# Copy Google verification file (ignore errors if not found)
if (Test-Path "googlec1c18fb443d3acae.html") {
    Copy-Item "googlec1c18fb443d3acae.html" dist/
}

# Copy Next.js static export into dist/console/
if (-not (Test-Path "dist/console")) {
    New-Item -ItemType Directory -Force -Path "dist/console" | Out-Null
}
Copy-Item -Recurse -Force "console/out/*" "dist/console/"

Write-Output "Build complete. Output in dist/"