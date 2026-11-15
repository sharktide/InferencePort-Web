/** Public homepage contracts: useful, verified examples and working navigation. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("index.html");
const css = read("styles/landing.css");
const navbar = read("components/ip-navbar.js");
const platform = read("platform.html");
const marketplace = read("marketplace.html");

test("every link from the shared navbar to the homepage has a stable anchor", () => {
  const ids = [...home.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Homepage contains duplicate IDs");
  const targets = [...navbar.matchAll(/\/index\.html#([a-z-]+)/g)].map((match) => match[1]);
  for (const target of targets) assert.ok(ids.includes(target), "Missing navbar anchor #" + target);
  for (const anchor of ["api", "agents", "council", "cli", "deploy", "buckets", "catalog",
    "lightning", "app", "shield", "organizations", "console", "pricing", "products"]) {
    assert.ok(ids.includes(anchor), "Missing anchor #" + anchor);
  }
  assert.match(home, /href="#main-content"/);
  assert.match(home, /<main class="lp" id="main-content">/);
});

test("API demo uses registered model IDs and parseable real request examples", () => {
  const examples = [...home.matchAll(/<div class="lp-code-example"[^>]*data-example-panel="([^"]+)"[^>]*>[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g)];
  assert.equal(examples.length, 3);
  const models = {
    text: { endpoint: "/v1/chat/completions", id: "deepseek-v4.1-flash-1017", field: "messages" },
    image: { endpoint: "/v1/images/generations", id: "lightning-image-turbo", field: "prompt" },
    embedding: { endpoint: "/v1/embeddings", id: "text-embedding-3-small", field: "input" },
  };
  for (const [, type, code] of examples) {
    const expected = models[type];
    assert.ok(expected, "Unknown example tab: " + type);
    assert.ok(code.includes("https://api.inferenceport.ai" + expected.endpoint));
    assert.match(code, /Authorization: Bearer \$IP_API_KEY/);
    assert.match(code, /Content-Type: application\/json/);
    const json = code.match(/-d '([\s\S]*?)'/)?.[1];
    assert.ok(json, type + ": missing JSON body");
    const body = JSON.parse(json);
    assert.equal(body.model, expected.id);
    assert.ok(body[expected.field], type + ": missing " + expected.field);
  }
  assert.match(home, /data-example-tab="text"/);
  assert.match(home, /data-example-tab="image"/);
  assert.match(home, /data-example-tab="embedding"/);
  assert.match(home, /event\.key === "ArrowRight"/);
  assert.match(home, /event\.key === "ArrowLeft"/);
  assert.match(home, /navigator\.clipboard\.writeText\(code\)/);
});

test("product sections link to usable next steps", () => {
  for (const fragment of [
    'href="/console/agents"', 'href="/console/buckets"', 'href="shield.html"',
    'href="ipx.html"', 'href="lightning.html"', 'href="install.html"',
    'href="platform.html#organizations"', 'href="marketplace.html"',
    'href="https://docs.inferenceport.ai/api/buckets.html"',
  ]) assert.ok(home.includes(fragment), "Missing product entry point: " + fragment);
  for (const phrase of [
    "Managed agents", "MCP tools", "S3-compatible", "PREVIEW", "Security",
    "wan2.7-t2v", "API key", "Usage", "Buckets",
  ]) assert.ok(home.toLowerCase().includes(phrase.toLowerCase()), "Missing useful detail: " + phrase);
  assert.match(platform, /<b>Buckets \(Preview\)<\/b>/);
  assert.doesNotMatch(home, /agent\/acme\/support-bot|2 connected|\$18\.20 Spend/);
});

test("homepage has intentional layout variation and responsive themes", () => {
  const sectionCount = [...home.matchAll(/<section\b/g)].length;
  assert.ok(sectionCount <= 8, "Homepage has excessive sections");
  assert.match(home, /class="lp-modality-matrix"/);
  assert.match(home, /class="lp-product-grid"/);
  assert.match(home, /class="lp-proof-agent"/);
  assert.match(home, /class="lp-proof-pair"/);
  assert.match(home, /class="lp-proof-shield"/);
  assert.match(home, /class="lp-workspace-layout"/);
  assert.match(home, /class="lp-org-spec"/);
  assert.match(home, /class="lp-shield-schema"/);
  assert.match(home, /class="lp-builder-grid"/);
  assert.doesNotMatch(home, /class="checks"|class="pgrid"|class="pc c-/);
  assert.match(home, /href="styles\/shared\.css"/);
  assert.match(home, /href="styles\/landing\.css"/);
  assert.doesNotMatch(home, /href="styles\/site\.css"/);
  assert.match(css, /\.lp-code-example\[hidden\]\s*\{\s*display:none !important;/);
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:630px\)/);
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--border\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.lp-code-tabs button:focus-visible/);
});

test("theme correctly switches the hero instead of forcing dark mode", () => {
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero \{/);
  assert.match(css, /background:#fafaf7;color:var\(--text-body\)/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero-copy h1/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-button-outline/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero-bottom/);
  assert.match(css, /\.lp-hero-overline > span:last-child \{ display:none; \}/);
});

test("specific infrastructure features remain discoverable in concise sections", () => {
  for (const term of [
    "HTTP or SSE tools", "Unlisted", "Owner- or caller-paid",
    "$0.50 per deployment", "model availability",
    "S3-compatible storage", "scoped, revocable SigV4 credentials",
    "risk_score", "confidence", "decision", "reasons",
    "SAML SSO", "allowed models and modalities",
    "API, deployment and storage charges",
    "1–3 review rounds", "OAuth or API key",
    "Ollama", "JSON output"
  ]) assert.ok(home.toLowerCase().includes(term.toLowerCase()), "Missing concrete capability: " + term);
});

test("every hosted model modality is prominent and opens its actual Marketplace filter", () => {
  const examples = {
    video: ["wan2.7-t2v"],
    audio: ["openai-tts-1"],
    "3d": ["trellis2"],
    realtime: ["gpt-realtime-2.1-mini"],
    text: ["deepseek-v4.1-flash-1017"],
    image: ["lightning-image-turbo"],
    embedding: ["text-embedding-3-small"],
    decision: ["microsoft/decision-1"],
  };
  assert.equal([...home.matchAll(/class="lp-modality-row"/g)].length, 8,
    "All eight modalities should use the same presentation");
  for (const [type, ids] of Object.entries(examples)) {
    const href = 'href="marketplace.html?modality=' + type + '"';
    assert.ok(home.includes(href), "Missing category link for " + type);
    assert.ok(home.includes('data-modality="' + type + '"'), "Missing category marker for " + type);
    for (const id of ids) assert.ok(home.includes(id), "Missing real model example: " + id);
    assert.ok(marketplace.includes('"' + type + '"'), "Market category unavailable: " + type);
  }
  assert.match(marketplace, /permittedModalities\.has\(requestedModality\)/);
  assert.match(marketplace, /tab\.classList\.toggle\("active", tab === selected\)/);
  assert.match(marketplace, /nextUrl\.searchParams\.set\("modality", activeFilter\)/);
  assert.match(marketplace, /window\.history\.replaceState\(/);
});

test("desktop modules have intentional spacing with tablet and mobile fallbacks", () => {
  assert.match(css, /@media \(min-width:1101px\)/);
  assert.match(css, /\.lp-proof-agent \{[^}]*grid-template-columns:/);
  assert.match(css, /\.lp-proof-pair \{[^}]*grid-template-columns:/);
  assert.match(css, /\.lp-workspace-layout \{[^}]*grid-template-columns:/);
  assert.match(css, /\.lp-proof-agent,\.lp-proof-shield,\.lp-proof-pair,\.lp-workspace-layout \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.lp-modality-matrix \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.lp-product-grid \{ grid-template-columns:1fr;/);
});

test("full product directory restores all twelve destinations without decorative marketing cards", () => {
  const cards = [...home.matchAll(/<a class="lp-product-card" href="(#.*?)">/g)];
  assert.equal(cards.length, 12, "Expected twelve distinct product links");
  const groups = [...home.matchAll(/class="lp-product-group-heading"/g)];
  assert.equal(groups.length, 3, "Expected Build, Deploy & run, Protect & manage groups");
  for (const group of ["Build", "Deploy &amp; run", "Protect &amp; manage"]) {
    assert.ok(home.includes("<h3>" + group + "</h3>"), "Missing product group " + group);
  }
  const ids = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = cards.map(m => m[1].slice(1));
  assert.equal(new Set(hrefs).size, 12, "Each card should have its own destination");
  for (const target of hrefs) assert.ok(ids.has(target), "Broken product-card anchor #" + target);
  assert.equal([...home.matchAll(/class="lp-product-icon"/g)].length, 12,
    "Each product should have a compact, monochrome icon");
  assert.match(css, /\.lp-product-card:hover \{[^}]*border-color:var\(--lp-group-line\)/);
  assert.doesNotMatch(css, /\.lp-product-card:hover \{[^}]*box-shadow/);
});

test("homepage follows the 7-part hierarchy with restrained group accents", () => {
  const hero = home.indexOf('class="lp-hero"');
  const products = home.indexOf('class="lp-section lp-products" id="products"');
  const api = home.indexOf('class="lp-section lp-models" id="api"');
  const details = home.indexOf('class="lp-section lp-stack" id="platform-details"');
  const workspace = home.indexOf('class="lp-section lp-workflow"');
  const ecosystem = home.indexOf('class="lp-section lp-more"');
  const pricing = home.indexOf('class="lp-section lp-pricing"');
  assert.ok(hero >= 0 && hero < products && products < api && api < details
    && details < workspace && workspace < ecosystem && ecosystem < pricing,
    "Expected Hero → Products → Eight modalities → Featured → Workspace → Ecosystem → Pricing");
  for (const group of ["build", "run", "manage"]) {
    assert.match(home, new RegExp('class="lp-product-group lp-product-group--' + group + '"'));
    assert.ok(css.includes(".lp-product-group--" + group + " {"), "Missing scoped group palette: " + group);
  }
  assert.match(css, /\.lp-product-symbol \{[^}]*background:var\(--lp-group-dim\)/);
  assert.match(css, /\.lp-product-card:first-child \{[^}]*border-top:2px solid var\(--lp-group-line\)/);
  assert.match(css, /\.lp-modality-matrix \{[^}]*border-top:3px solid var\(--gold\)/);
  assert.doesNotMatch(css, /\.lp-product-card:hover \{[^}]*box-shadow/);
  assert.equal([...home.matchAll(/class="lp-product-card"/g)].length, 12);
  assert.equal([...home.matchAll(/class="lp-modality-row"/g)].length, 8);
});

test("product category icons match their labels", () => {
  const iconFor = (link) => home.match(new RegExp('<a class="lp-product-card" href="#' + link + '">[\\s\\S]*?(<svg[\\s\\S]*?<\\/svg>)'))?.[1] || "";
  assert.match(iconFor("buckets"), /m3 7 9-4 9 4-9 4-9-4Z/);
  assert.match(iconFor("lightning"), /M13 3L5 13\.5h6L10 21/);
  assert.match(iconFor("app"), /<rect x="3" y="4" width="18" height="12"/);
  assert.match(iconFor("catalog"), /M12 3l9 5-9 5-9-5z/);
});

test("proof panels show genuine control structures without pretending to be live data", () => {
  for (const term of [
    "CONFIGURATION PREVIEW", "Backing model", "System instructions",
    "MCP servers", "Request billing", "Published", "MODEL DEPLOYMENTS",
    "aws --endpoint-url", "POST /ai-shield/analyze",
    "RESPONSE FIELDS", "Illustrative control layout"
  ]) assert.ok(home.includes(term), "Missing useful product proof: " + term);
  assert.match(home, /class="lp-proof-interface" aria-label="Illustration/);
  assert.doesNotMatch(home, /12\.4k Requests|\$18\.20 Spend|Customer logo|agent\/acme\/support-bot/);
});

test("console and organizations share one coherent workspace section", () => {
  const workspaceStart = home.indexOf('class="lp-section lp-workflow"');
  const workspaceEnd = home.indexOf('class="lp-section lp-more"', workspaceStart);
  const workspace = home.slice(workspaceStart, workspaceEnd);
  assert.match(workspace, /id="console"/);
  assert.match(workspace, /id="organizations"/);
  assert.match(workspace, /class="lp-workspace-console"/);
  assert.match(workspace, /class="lp-workspace-org"/);
  assert.match(workspace, /API, deployment and storage charges/);
  assert.match(workspace, /per-member and per-key limits/);
  assert.doesNotMatch(home.slice(home.indexOf('class="lp-section lp-stack"'), workspaceStart), /id="organizations"/);
});

test("pricing keeps distinct API, deployment, storage, and subscription billing", () => {
  for (const label of ["MODEL API", "DEPLOYMENTS", "BUCKETS", "CHAT &amp; TEAMS"]) {
    assert.ok(home.includes("<span>" + label + "</span>"), "Missing billing category " + label);
  }
  assert.match(home, /Storage, requests &amp; transfer/);
  assert.match(home, /Deployment fee \+ usage/);
  assert.match(home, /Model-specific usage/);
  assert.match(home, /Hosted chat subscriptions/);
});

test("hero renders a meaningful 3D topology and accessible functional fallback", () => {
  const js = read("scripts/home-topology.js");
  assert.match(home, /id="lp-topology"/);
  assert.match(home, /class="lp-topology-webgl" aria-hidden="true"/);
  assert.match(home, /class="lp-topology-fallback"/);
  assert.match(home, /<nav class="lp-topology-labels" aria-label="Explore the InferencePort platform">/);
  assert.match(home, /<script type="module" src="scripts\/home-topology\.js"><\/script>/);
  const nodes = [...home.matchAll(/class="lp-topology-node" data-node="([^"]+)" href="([^"]+)"/g)];
  assert.equal(nodes.length, 7);
  assert.deepEqual(nodes.map(n => n[1]), ["models","agents","deployments","buckets","shield","organizations","console"]);
  const allIds = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const [, , href] of nodes) {
    assert.ok(href.startsWith("#") && allIds.has(href.slice(1)), "Broken 3D node link: " + href);
  }
  assert.equal([...home.matchAll(/data-satellite="(video|audio|3d|realtime)"/g)].length, 4);
  assert.match(js, /new THREE\.WebGLRenderer\(/);
  assert.match(js, /THREE\.IcosahedronGeometry/);
  assert.match(js, /THREE\.TorusGeometry/);
  assert.match(js, /THREE\.Raycaster/);
  assert.match(js, /new THREE\.QuadraticBezierCurve3/);
  assert.match(js, /import\(THREE_MODULE_URL\)/);
  assert.match(js, /three@0\.171\.0\/build\/three\.module\.js/);
  assert.doesNotMatch(js, /window\.localStorage|fetch\(.*\/users|Math\.random\(/);
});

test("3D system is lazy, theme-aware, pausable, and not mandatory for navigation", () => {
  const js = read("scripts/home-topology.js");
  for (const feature of [
    "IntersectionObserver", "ResizeObserver", "prefers-reduced-motion",
    "ip-theme-change", "webglcontextlost", "document.visibilityState",
    "requestAnimationFrame", "cancelAnimationFrame", "renderer.dispose()"
  ]) assert.ok(js.includes(feature), "Missing 3D lifecycle feature: " + feature);
  assert.match(css, /\.lp-topology-shell\.is-3d \.lp-topology-fallback \{ opacity:0; \}/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /\.lp-topology-node \{[\s\S]*?position:static;[\s\S]*?left:auto!important;/);
  assert.match(css, /:root\[data-theme="dark"\] \.lp-topology-shell/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero-demo/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  const { execFileSync } = require("node:child_process");
  assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", path.join(root, "scripts/home-topology.js")]));
});

test("quickstart is still interactive and now has room beneath the hero graph", () => {
  assert.match(home, /class="lp-hero-demo"/);
  assert.match(home, /class="lp-hero-demo-intro"/);
  assert.match(home, /class="lp-code" aria-label="Copyable API quickstart examples"/);
  assert.match(css, /\.lp-hero-demo \{ display:grid;grid-template-columns:/);
  assert.match(css, /\.lp-wrap \{ width:min\(1392px,calc\(100% - 88px\)\); \}/);
  assert.match(css, /\.lp-section \{ padding:clamp\(112px,10vw,162px\) 0; \}/);
  assert.match(css, /\.lp-modality-row\[data-modality="realtime"\]::after/);
});

test("mobile uses WebGL on capable devices rather than a forced static fallback", () => {
  const js = read("scripts/home-topology.js");
  assert.match(js, /const canAnimate = \(\) => !disposed && !reduced\.matches;/);
  assert.doesNotMatch(js, /!compact\.matches;/);
  assert.match(css, /\.lp-topology-webgl \{ display:block; \}/);
  assert.match(css, /\.lp-topology-labels \{[\s\S]*?scroll-snap-type:x proximity;/);
  assert.match(css, /\.lp-hero-grid \{ display:flex;flex-direction:column;gap:8px;/);
  assert.match(css, /\.lp-topology-shell \{[\s\S]*?order:-1;/);
  assert.match(css, /\.lp-topology-inspector \{[\s\S]*?bottom:55px;/);
  assert.match(js, /compact\.matches \? 1\.25 : 1\.75/);
  assert.match(js, /compact\.matches \? 45 : 32/);
});

test("the centerpiece is a real extruded branded mark with touch interaction", () => {
  const js = read("scripts/home-topology.js");
  assert.match(js, /new THREE\.ExtrudeGeometry\(bolt/);
  assert.match(js, /new THREE\.MeshPhysicalMaterial\(/);
  assert.match(js, /new THREE\.PointLight\(/);
  assert.match(js, /new THREE\.TorusGeometry\(/);
  assert.match(js, /function onPointerDown\(event\)/);
  assert.match(js, /function onPointerUp\(\)/);
  assert.match(js, /if \(compact\.matches && selected !== id\)/);
  assert.match(js, /function updateInspector\(id\)/);
  assert.match(home, /data-topology-inspector/);
  assert.match(home, /data-topology-title/);
  assert.match(home, /data-topology-description/);
  assert.match(home, /data-topology-explore/);
  assert.match(home, /DRAG TO ROTATE/);
  assert.match(js, /NODE_DESCRIPTIONS/);
  assert.doesNotMatch(home, /class="lp-topology-labels"[^>]*role="button"/);
});

test("visual richness uses branded 3D geometry and meaningful node constellations", () => {
  const js = read("scripts/home-topology.js");
  assert.match(js, /new THREE\.ExtrudeGeometry\(bolt/);
  assert.match(js, /new THREE\.MeshPhysicalMaterial\(/);
  assert.match(js, /const cluster = new THREE\.Group\(\)/);
  assert.match(js, /const beadCount = n\.primary \? \(compact\.matches \? 4 : 6\) : 3;/);
  assert.match(js, /new THREE\.TorusGeometry\(0\.32,/);
  assert.match(js, /cluster\.rotation\.z/);
  assert.match(js, /NODE_DESCRIPTIONS/);
});
