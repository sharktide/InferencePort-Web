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
  ["zero embedding rate falls back to a paid token rate", {"type":"embedding","input_pricing_per_million_tokens":"0","pricing":{"prompt":"0.000003"}}, 3, "$3/M tokens"],
  ["zero realtime token rate does not mask paid hourly audio", {"type":"realtime","realtime_pricing_per_million_tokens":{"audio_in":"0"},"input_price_per_second":"0.01"}, 36, "Audio in: $0/M · Audio: $36/hour"],
  ["text input zero does not mask paid output", {"type":"text","pricing":{"prompt":"0","completion":"0.000001"}}, 1, "In: $0/M · Out: $1/M"],
  ["untyped 3D output takes precedence over text", {"input_modalities":["text"],"output_modalities":["text","3d"],"price_tiers":{"low":"0.05","high":"0.07"}}, 0.05, "$0.05-$0.07/model"],
  ["tier zero does not mask a paid request", {"type":"3d","price_tiers":{"low":"0"},"pricing":{"request":"2"}}, 2, "$0.0000/model · Request: $2.0000/model"],
  ["per-character audio does not compare an unrelated request rate", {"type":"audio","billing_unit":"input_chars","price_per_1k_chars":"1.25","pricing":{"request":"0.01"}}, 1.25, "$1.25/1k chars"],
  ["per-byte audio does not compare an unrelated request rate", {"type":"audio","billing_unit":"input_bytes","price_per_million_bytes":"0.75","pricing":{"request":"0.01"}}, 0.75, "$0.75/M bytes"],
  ["per-character audio with no character rate is unpriced", {"type":"audio","billing_unit":"input_chars","pricing":{"request":"1"}}, null, null],
  ["seconds audio request fallback uses declared second billing unit", {"type":"audio","billing_unit":"input_seconds","pricing":{"request":"0.02"}}, 0.02, "$0.02/input sec"],
  ["image request-only prices are displayed", {"type":"image","pricing":{"request":"0.03"}}, 0.03, "$0.03/request"],
  ["image zero rate is explicitly displayed", {"type":"image","pricing":{"image":"0"}}, 0, "$0/gen"],
  ["image zero does not mask a paid image token rate", {"type":"image","pricing":{"image":"0","token_pricing":{"image_out":"0.8"}}}, 0.8, "$0/gen · Img Out: $0.8/M tokens"],
  ["video top-level per-second prices are displayed", {"type":"video","price_per_second":"0.12"}, 0.12, "$0.12/sec"],
  ["video zero request does not mask per-second price", {"type":"video","pricing":{"request":"0"},"price_per_second":"0.12"}, 0.12, "$0.12/sec"],
  ["malformed numeric prefixes are unknown", {"type":"text","pricing":{"prompt":"0.5invalid"}}, null, null],
  ["nonfinite values are unknown", {"type":"video","pricing":{"request":"Infinity"}}, null, null],
  ["boolean values are not valid rates", {"type":"image","pricing":{"image":true}}, null, null],
  ["scientific notation is a valid full numeric string", {"type":"embedding","pricing":{"prompt":" 1e-6 "}}, 1, "$1/M tokens"],
  ["no published rates remain unknown", {"type":"text","pricing":{}}, null, null],
  ["untyped image plus 3D uses the same pricing on both surfaces", {"output_modalities":["image","3d"],"price_tiers":{"low":"0.11"},"pricing":{"image":"0.02"}}, 0.11, "$0.1100/model"],
  ["free text tokens still display a positive request fee", {"type":"text","pricing":{"prompt":0,"completion":0,"request":1.75}}, 1.75, "In: $0/M · Out: $0/M · $1.75/request"],
  ["audio models fall back to generic token prices", {"type":"audio","billing_unit":"input_chars","pricing":{"prompt":"0.000004","completion":"0.000012"}}, 4, "In: $4/M · Out: $12/M"],
  ["image models fall back to generic token prices", {"type":"image","pricing":{"prompt":"0.000002"}}, 2, "In: $2/M"],
  ["3D models fall back to generic token prices", {"type":"3d","pricing":{"completion":"0.000009"}}, 9, "Out: $9/M"],
  ["video models fall back to generic token prices", {"type":"video","pricing":{"prompt":"0.000005"}}, 5, "In: $5/M"],
  ["unclassified multimodal token prices remain visible", {"pricing":{"token_pricing":{"image_out":"0.8125"}}}, 0.8125, "Img Out: $0.8125/M tokens"],
  ["zero video second fee does not hide paid token rates", {"type":"video","pricing":{"request":0,"prompt":"0.000005"}}, 5, "$0/sec · In: $5/M"],
  ["zero audio second fee does not hide paid token rates", {"type":"audio","price_per_second":0,"pricing":{"prompt":"0.000008"}}, 8, "$0/sec · In: $8/M"],
  ["unclassified mixed token and request rates remain visible", {"type":"text","pricing":{"token_pricing":{"text_in":2,"image_out":0.9},"prompt":"0.000003","request":0.2}}, 0.2, "In: $3/M · Text: $2/M tokens · Img Out: $0.9/M tokens · $0.2/request"],
];

for (const [surface, pricing] of [["console", consoleExports], ["marketplace", marketplaceExports]]) {
  for (const [name, model, expectedRate, expectedLabel] of cases) {
    test(`${surface}: ${name}`, () => {
      assert.equal(pricing.modelStartingPrice(model), expectedRate);
      const displayed = pricing.formatModelPrice(model);
      // Full equality catches wrong amounts, extra digits, missing currency, or units.
      assert.equal(displayed, expectedLabel);
      if (surface === "console") assert.equal(pricing.formatPricing(model), expectedLabel);
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

test("console and Marketplace infer 3D before image for an untyped multimodal model", () => {
  const model = { output_modalities: ["image", "3d"], price_tiers: { low: "0.11" }, pricing: { image: "0.02" } };
  assert.equal(consoleExports.modelType(model), "3d");
  assert.equal(marketplaceExports.modelType(model), "3d");
});

test("console and Marketplace agree on modality inference", () => {
  for (const [, model] of cases) {
    assert.equal(consoleExports.modelType(model), marketplaceExports.modelType(model));
  }
});
