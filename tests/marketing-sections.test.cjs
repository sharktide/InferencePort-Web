/** Static content checks for Buckets, Agents and Organizations marketing sections. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const home = read("index.html");
const site = read("styles/site.css");
const navbar = read("components/ip-navbar.js");
const platform = read("platform.html");

test("feature anchors and product catalog stay in sync", () => {
  const ids = [...home.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ["agents", "organizations", "buckets", "deploy", "console"]) {
    assert.equal(ids.filter((candidate) => candidate === id).length, 1, id + " section must be unique");
  }
  const productGrid = home.split('<!-- ═════════ PRODUCTS ═════════ -->')[1].split('<!-- ═════════ API ═════════ -->')[0];
  assert.equal([...productGrid.matchAll(/<a class="pc c-/g)].length, 12);
  assert.match(productGrid, /href="#buckets"/);
  assert.match(navbar, /"\/index\.html#buckets"/);
  assert.match(navbar, /buckets: `<path /);
});

test("Buckets preview explains workspace-scoped S3 connections accurately", () => {
  const section = home.split('<section class="blk alt" id="buckets">')[1].split('<!-- ═════════ SHIELD ═════════ -->')[0];
  assert.ok(section, "Buckets section should render");
  for (const content of ["S3-compatible", "Azure Blob Storage", "AWS Signature V4", "personal or organization", "Preview"]) {
    assert.ok(section.includes(content), "Missing Buckets detail: " + content);
  }
  assert.match(section, /href="\/console\/buckets"/);
  assert.match(section, /href="https:\/\/docs\.inferenceport\.ai\/api\/buckets\.html"/);
  assert.match(section, /Illustrative Buckets file browser/);
  assert.match(platform, /<b>Buckets \(Preview\)<\/b>/);
});

test("Agents and Organizations explain their workflows, not just product names", () => {
  for (const fragment of [
    "agent/&lt;username&gt;/&lt;agent-id&gt;",
    "MCP tools", "tool calling", "Call via API", "Choose who pays"
  ]) assert.ok(home.includes(fragment), "Missing agent flow: " + fragment);
  for (const fragment of ["Shared wallet", "Guardrails for API usage", "SAML SSO", "Audit and reporting", "Desktop policies"]) {
    assert.ok(home.includes(fragment), "Missing organization detail: " + fragment);
  }
});

test("Buckets UI remains usable on small screens and dark backgrounds", () => {
  for (const token of [
    ".bucket-demo", ".bucket-endpoint code", "overflow-wrap: anywhere;",
    ".bucket-demo-foot", ".agent-flow", "@media (max-width: 600px)",
    ':root[data-theme="dark"] .bucket-demo-bar'
  ]) assert.ok(site.includes(token), "Missing presentation token: " + token);
  assert.match(home, /id="buckets"/);
});
