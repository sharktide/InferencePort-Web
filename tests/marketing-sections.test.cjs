/** Homepage content and accessibility contracts for the compact landing page. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const home = read("index.html");
const css = read("styles/landing.css");
const navbar = read("components/ip-navbar.js");

test("navbar deep links still resolve to unique homepage anchors", () => {
  const ids = [...home.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, "duplicate HTML ids");
  for (const id of [
    "api", "agents", "council", "cli", "deploy", "buckets", "catalog",
    "lightning", "app", "shield", "organizations", "console", "pricing",
  ]) {
    assert.ok(ids.includes(id), "Missing anchor: #" + id);
  }
  assert.match(navbar, /"\/index\.html#buckets"/);
  assert.match(navbar, /"\/index\.html#agents"/);
  assert.match(home, /href="\/console\/buckets"/);
  assert.match(home, /href="\/console\/agents"/);
});

test("homepage replaces repetitive marketing cards with a shorter structure", () => {
  const sections = [...home.matchAll(/<section\b/g)].length;
  assert.ok(sections <= 7, "Landing page has too many major sections: " + sections);
  assert.equal([...home.matchAll(/class="lp-pillar"/g)].length, 3);
  for (const oldPattern of [/class="pc c-/, /class="checks"/, /class="panel"/, /class="chip y"/]) {
    assert.doesNotMatch(home, oldPattern, "Obsolete repetitive marketing UI found");
  }
  assert.match(home, /<h1 id="lp-title">/);
  assert.match(home, /<a class="lp-skip" href="#main-content">/);
  assert.match(home, /<main class="lp" id="main-content">/);
});

test("hero API request includes a real text model and required headers", () => {
  const example = home.match(/<pre id="lp-request"><code>([\s\S]*?)<\/code><\/pre>/)?.[1];
  assert.ok(example, "Missing copyable request example");
  assert.match(example, /https:\/\/api\.inferenceport\.ai\/v1\/chat\/completions/);
  assert.match(example, /Authorization: Bearer \$IP_API_KEY/);
  assert.match(example, /Content-Type: application\/json/);
  const body = example.match(/-d '([\s\S]*?)'\s*$/)?.[1];
  assert.ok(body, "Missing JSON request body");
  const parsed = JSON.parse(body);
  assert.equal(parsed.model, "deepseek-v4.1-flash-1017");
  assert.deepEqual(parsed.messages, [{ role: "user", content: "Hello" }]);
  assert.match(home, /data-copy-request/);
  assert.match(home, /navigator\.clipboard\.writeText/);
});

test("products and pricing remain specific without fictional trust signals", () => {
  for (const copy of [
    "OpenAI-compatible", "Buckets", "Preview", "S3-compatible",
    "Managed agents", "Council MCP", "AI Shield", "Organizations",
    "Model API", "Chat &amp; desktop", "Shared billing",
  ]) {
    assert.match(home.toLowerCase(), new RegExp(copy.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(home, /href="https:\/\/docs\.inferenceport\.ai\/api\/buckets\.html"/);
  assert.match(home, /href="pricing\.html#organizations"/);
  assert.doesNotMatch(home, /agent\/acme\/support-bot|Illustrative Buckets file browser/);
});

test("scoped responsive styles support light and dark themes", () => {
  assert.match(home, /href="styles\/shared\.css"/);
  assert.match(home, /href="styles\/landing\.css"/);
  assert.doesNotMatch(home, /href="styles\/site\.css"/);
  assert.match(css, /\.lp-hero-grid/);
  assert.match(css, /\.lp-pillars/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--border\)/);
  assert.match(css, /\.lp-copy:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
