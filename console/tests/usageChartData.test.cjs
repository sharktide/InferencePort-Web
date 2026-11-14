const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/usageChartData.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = { exports: {} };
vm.runInNewContext(compiled, { exports: scope.exports, module: scope, Date, Math });
const { trendBins, pieSlices } = scope.exports;

test("7d trend includes seven UTC calendar bins, including empty days", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  const result = trendBins([
    { key: "2026-11-13", label: "13 Nov", credits: 2, requests: 4 },
    { key: "2026-11-10", label: "10 Nov", credits: 1, requests: 1 },
  ], "7d", now);
  assert.equal(result.interval, "day");
  assert.equal(result.bins.length, 7);
  assert.equal(result.bins[0].key, "2026-11-07");
  assert.equal(result.bins[0].credits, 0);
  assert.equal(result.bins[3].credits, 1);
  assert.equal(result.bins[6].credits, 2);
  assert.equal(result.bins[6].requests, 4);
});

test("24h trend supports hourly timestamps and shows distinct bins", () => {
  const now = Date.parse("2026-11-13T18:30:00Z");
  const result = trendBins([
    { key: "2026-11-13T18", label: "18", credits: 4, requests: 2 },
    { key: "2026-11-13T17", label: "17", credits: 2, requests: 8 },
  ], "24h", now);
  assert.equal(result.interval, "hour");
  assert.equal(result.bins.length, 24);
  assert.equal(result.bins[22].credits, 2);
  assert.equal(result.bins[23].requests, 2);
});

test("donut chart isolates top five segments and combines the remainder", () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    key: "model-" + i, label: "Model " + i,
    credits: 7 - i, requests: i + 1,
  }));
  const slices = pieSlices(rows, "credits");
  assert.equal(slices.length, 6);
  assert.equal(slices[5].key, "__remaining_groups__");
  assert.equal(slices.reduce((sum, item) => sum + item.value, 0), 28);
  assert.ok(Math.abs(slices.reduce((sum, item) => sum + item.share, 0) - 100) < 0.01);
  assert.equal(pieSlices(rows, "requests")[0].key, "model-6");
  assert.equal(pieSlices([], "credits").length, 0);
});

test("donut hover styling never changes the SVG segment's hit geometry", () => {
  const css = fs.readFileSync(path.join(__dirname, "../src/components/console/panels/UsageCharts.module.css"), "utf8");
  const hover = css.match(/\.arc:hover[^{]*\{([^}]*)\}/);
  assert.ok(hover, "donut hover style exists");
  assert.doesNotMatch(hover[1], /stroke-width|transform|scale|r\s*:/);
  const source = fs.readFileSync(path.join(__dirname, "../src/components/console/panels/UsageCharts.tsx"), "utf8");
  assert.ok(source.includes('className={s.inspect} aria-live="polite"'));
  assert.ok(source.includes("activeSlice ? ("));
});

test("service selector cards wrap at mobile width instead of leaking outside the viewport", () => {
  const css = fs.readFileSync(path.join(__dirname, "../src/components/console/panels/orgs/UsageServices.module.css"), "utf8");
  const card = css.match(/\.card\s*\{([^}]*)\}/);
  assert.ok(card);
  assert.match(card[1], /white-space:\s*normal/);
  assert.match(card[1], /min-width:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.serviceCards\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.cardHint\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("donut legend uses the button grid and preserves model labels on phones", () => {
  const css = fs.readFileSync(path.join(__dirname, "../src/components/console/panels/UsageCharts.module.css"), "utf8");
  const item = css.match(/\.legend li\s*\{([^}]*)\}/);
  const button = css.match(/\.legendButton\s*\{([^}]*)\}/);
  assert.ok(item && button);
  assert.match(item[1], /display:\s*block/);
  assert.doesNotMatch(item[1], /grid-template-columns/);
  assert.match(button[1], /grid-template-columns:/);
  assert.match(button[1], /white-space:\s*normal/);
  assert.match(css, /\.legendLabel\s*\{\s*white-space:\s*normal;\s*overflow-wrap:\s*anywhere;/);
});
