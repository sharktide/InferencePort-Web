const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/usageAnalytics.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleContext.exports, module: moduleContext, Date, Map, Number, String, Array, RegExp });
const { amountSpent, recentUsage, usageGroups, totals, csvCell, usageCsv } = moduleContext.exports;

const now = Date.parse("2026-11-13T20:00:00Z");
const entries = [
  { id: "a", entry_type: "usage", model: "m-one", usage_kind: "text", delta_credits: -1.5, units: 100, created_at: "2026-11-13T18:00:00Z" },
  { id: "b", entry_type: "usage", model: "m-one", usage_kind: "text", delta_credits: -0.5, created_at: "2026-11-12T18:00:00Z" },
  { id: "c", entry_type: "usage", model: "m-two", usage_kind: "image", delta_credits: -3, created_at: "2026-11-01T18:00:00Z" },
  { id: "d", entry_type: "purchase", model: "m-two", delta_credits: 10, created_at: "2026-11-13T19:00:00Z" },
  { id: "e", entry_type: "adjustment", model: "m-two", delta_credits: 2, created_at: "2026-11-13T19:00:00Z" },
  { id: "f", entry_type: "deployment", model: "m-three", delta_credits: 0, created_at: "2026-11-13T18:00:00Z" },
];

test("personal aggregation excludes purchases, deployments and refunds", () => {
  const usage = recentUsage(entries, "all", now);
  assert.equal(usage.length, 3);
  assert.equal(totals(usage).credits, 5);
  assert.equal(totals(usage).requests, 3);
  assert.equal(amountSpent({ entry_type: "usage", delta_credits: 2 }), 0);
});

test("relative periods use timestamps rather than page-local dates", () => {
  assert.equal(recentUsage(entries, "24h", now).length, 1);
  assert.equal(recentUsage(entries, "7d", now).length, 2);
  assert.equal(recentUsage(entries, "30d", now).length, 3);
  assert.equal(recentUsage([{ entry_type: "usage", delta_credits: -1 }], "24h", now).length, 0);
});

test("dimensions retain the same totals and group UTC days consistently", () => {
  const usage = recentUsage(entries, "all", now);
  const models = usageGroups(usage, "model");
  assert.equal(models.find((r) => r.key === "m-one").credits, 2);
  assert.equal(models.find((r) => r.key === "m-one").requests, 2);
  assert.equal(usageGroups(usage, "modality").find((r) => r.key === "image").credits, 3);
  assert.equal(usageGroups(usage, "day").find((r) => r.key === "2026-11-13").requests, 1);
});

test("CSV quotes input and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "\"'=HYPERLINK(1)\"");
  assert.equal(csvCell("-SUM(2)"), "\"'-SUM(2)\"");
  assert.equal(csvCell("hello,\"world\""), "\"hello,\"\"world\"\"\"");
  const result = usageCsv([{ entry_type: "usage", delta_credits: -1, model: "=unsafe", usage_kind: "text" }]);
  assert.ok(result.includes("\"'=unsafe\""));
  assert.ok(result.includes("\"1.0000\""));
});
