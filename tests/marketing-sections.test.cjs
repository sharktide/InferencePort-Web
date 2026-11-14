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
    'href="pricing.html#organizations"', 'href="marketplace.html"',
    'href="https://docs.inferenceport.ai/api/buckets.html"',
  ]) assert.ok(home.includes(fragment), "Missing product entry point: " + fragment);
  for (const phrase of [
    "Managed agents", "MCP tools", "S3-compatible", "PREVIEW", "Security",
    "Gemini 4 Carbon", "API key", "Usage", "Buckets",
  ]) assert.ok(home.toLowerCase().includes(phrase.toLowerCase()), "Missing useful detail: " + phrase);
  assert.match(platform, /<b>Buckets \(Preview\)<\/b>/);
  assert.doesNotMatch(home, /agent\/acme\/support-bot|2 connected|Published<\/span>/);
});

test("homepage has intentional layout variation and responsive themes", () => {
  const sectionCount = [...home.matchAll(/<section\b/g)].length;
  assert.ok(sectionCount <= 8, "Homepage has excessive sections");
  assert.match(home, /class="lp-model-ledger"/);
  assert.match(home, /class="lp-stack-layout"/);
  assert.match(home, /class="lp-ops-layout"/);
  assert.match(home, /class="lp-agent-spec"/);
  assert.match(home, /class="lp-org-spec"/);
  assert.match(home, /class="lp-shield-response"/);
  assert.match(home, /class="lp-console-layout"/);
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
    "HTTP or SSE MCP", "share unlisted", "Owner- or caller-paid",
    "$0.50 per deployment", "warm availability",
    "AWS Signature V4", "Revocable credentials", "Azure Blob Storage",
    "risk_score", "confidence", "decision", "reasons",
    "SAML SSO", "model and modality restrictions",
    "separate API, storage and deployment charges",
    "1–3 review rounds", "OAuth or API key",
    "Ollama", "JSON output"
  ]) assert.ok(home.toLowerCase().includes(term.toLowerCase()), "Missing concrete capability: " + term);
});
