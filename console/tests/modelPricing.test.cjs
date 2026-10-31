const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const pricingSource = fs.readFileSync(path.join(__dirname, "../src/lib/modelPricing.ts"), "utf8");
const compiled = ts.transpileModule(pricingSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const consoleExports = {};
vm.runInNewContext(compiled, { exports: consoleExports, module: { exports: consoleExports } });

const marketplaceHtml = fs.readFileSync(path.join(__dirname, "../../marketplace.html"), "utf8");
const slice = (startMarker, endMarker) => {
  const start = marketplaceHtml.indexOf(startMarker);
  const end = marketplaceHtml.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing Marketplace section: ${startMarker}`);
  return marketplaceHtml.slice(start, end);
};
// Exercise the actual Marketplace script functions without fetching data or using a DOM.
const marketplaceExports = vm.runInNewContext([
  slice("function modelType(m) {", "function pillClass(type) {"),
  slice("function formatEmbeddingPrice(m) {", "function num(v) {"),
  slice("function num(v) {", "// Audio models bill on four different units"),
  slice("function formatAudioPrice(m) {", "function formatPrice(m) {"),
  slice("function modelStartingPrice(m) {", "function matchesPriceRange(price) {"),
  "({ modelType, modelStartingPrice, formatModelPrice })",
].join("\n"), {});

const cases = [
  ["zero embedding rate falls back to a paid token rate",
    { type: "embedding", input_pricing_per_million_tokens: "0", pricing: { prompt: "0.000003" } }, 3, "$3"],
  ["zero realtime token rate does not mask paid hourly audio",
    { type: "realtime", realtime_pricing_per_million_tokens: { audio_in: "0" }, input_price_per_second: "0.01" }, 36, "$36/hour"],
  ["text input zero does not mask paid output",
    { type: "text", pricing: { prompt: "0", completion: "0.000001" } }, 1, "$1"],
  ["untyped 3D output takes precedence over text",
    { input_modalities: ["text"], output_modalities: ["text", "3d"], price_tiers: { low: "0.05", high: "0.07" } }, 0.05, "$0.05"],
  ["tier zero does not mask a paid request",
    { type: "3d", price_tiers: { low: "0" }, pricing: { request: "2" } }, 2, "$2"],
  ["per-character audio does not compare an unrelated request rate",
    { type: "audio", billing_unit: "input_chars", price_per_1k_chars: "1.25", pricing: { request: "0.01" } }, 1.25, "$1.25/1k chars"],
  ["per-byte audio does not compare an unrelated request rate",
    { type: "audio", billing_unit: "input_bytes", price_per_million_bytes: "0.75", pricing: { request: "0.01" } }, 0.75, "$0.75/M bytes"],
  ["per-character audio with no character rate is unpriced",
    { type: "audio", billing_unit: "input_chars", pricing: { request: "1" } }, null, null],
  ["seconds audio request fallback uses declared second billing unit",
    { type: "audio", billing_unit: "input_seconds", pricing: { request: "0.02" } }, 0.02, "$0.02/input sec"],
  ["image request-only prices are displayed",
    { type: "image", pricing: { request: "0.03" } }, 0.03, "$0.03/request"],
  ["image zero rate is explicitly displayed",
    { type: "image", pricing: { image: "0" } }, 0, "$0/gen"],
  ["image zero does not mask a paid image token rate",
    { type: "image", pricing: { image: "0", token_pricing: { image_out: "0.8" } } }, 0.8, "$0.8"],
  ["video top-level per-second prices are displayed",
    { type: "video", price_per_second: "0.12" }, 0.12, "$0.12/sec"],
  ["video zero request does not mask per-second price",
    { type: "video", pricing: { request: "0" }, price_per_second: "0.12" }, 0.12, "$0.12/sec"],
  ["malformed numeric prefixes are unknown",
    { type: "text", pricing: { prompt: "0.5invalid" } }, null, null],
  ["nonfinite values are unknown",
    { type: "video", pricing: { request: "Infinity" } }, null, null],
  ["boolean values are not valid rates",
    { type: "image", pricing: { image: true } }, null, null],
  ["scientific notation is a valid full numeric string",
    { type: "embedding", pricing: { prompt: " 1e-6 " } }, 1, "$1"],
  ["no published rates remain unknown",
    { type: "text", pricing: {} }, null, null],
];

for (const [surface, pricing] of [["console", consoleExports], ["marketplace", marketplaceExports]]) {
  for (const [name, model, expectedRate, expectedLabel] of cases) {
    test(`${surface}: ${name}`, () => {
      assert.equal(pricing.modelStartingPrice(model), expectedRate);
      const displayed = pricing.formatModelPrice(model);
      if (expectedLabel === null) assert.equal(displayed, null);
      else assert.ok(displayed?.includes(expectedLabel), `Expected "${expectedLabel}" in "${displayed}"`);
    });
  }
}

test("console: unpriced models sort last in both directions", () => {
  const free = { type: "image", pricing: { image: "0" } };
  const paid = { type: "image", pricing: { image: "2" } };
  const missing = { type: "image" };
  assert.ok(consoleExports.compareModelPrice(free, paid, "asc") < 0);
  assert.ok(consoleExports.compareModelPrice(paid, free, "desc") < 0);
  assert.ok(consoleExports.compareModelPrice(missing, paid, "asc") > 0);
  assert.ok(consoleExports.compareModelPrice(missing, paid, "desc") > 0);
});
