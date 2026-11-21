const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/consoleNavigation.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleContext.exports, module: moduleContext });
const {
  PERSONAL_GROUPS, PERSONAL_MORE, PERSONAL_DOCK,
  ORG_WORK, ORG_MANAGE, ORG_MORE, ORG_DOCK, ORG_READ_ONLY_DOCK, navHighlight,
} = moduleContext.exports;

const ids = (items) => Array.from(items, (item) => item.id);
const groupIds = (groups) => groups.flatMap((group) => ids(group.items));

test("important personal work stays one click away", () => {
  const direct = groupIds(PERSONAL_GROUPS);
  assert.deepEqual(ids(PERSONAL_GROUPS.map((group) => ({ id: group.title }))), ["Explore", "Build", "Monitor"]);
  assert.ok(direct.includes("playground"));
  assert.ok(direct.includes("models"));
  for (const id of ["api-key", "agents", "deploy", "buckets", "shield", "usage", "billing"]) assert.ok(direct.includes(id), id);
  assert.equal(new Set([...direct, ...ids(PERSONAL_MORE)]).size, direct.length + PERSONAL_MORE.length);
});

test("specialized guides and MCP remain reachable without clutter", () => {
  assert.deepEqual(ids(PERSONAL_MORE), ["mcp", "payg-api", "gen-api"]);
  assert.equal(new Set(ids(ORG_WORK).concat(ids(ORG_MANAGE), ids(ORG_MORE))).size,
    ORG_WORK.length + ORG_MANAGE.length + ORG_MORE.length);
  assert.ok(ids(ORG_MANAGE).includes("org-security"));
  assert.ok(ids(ORG_MORE).includes("org-audit"));
});

test("mobile shows four useful actions and delegates other work to More", () => {
  assert.deepEqual(ids(PERSONAL_DOCK), ["playground", "models", "api-key", "usage"]);
  assert.deepEqual(ids(ORG_DOCK), ["playground", "models", "org-keys", "org-usage"]);
  assert.deepEqual(ids(ORG_READ_ONLY_DOCK), ["org-overview", "org-keys", "org-usage", "org-members"]);
});

test("legacy paths highlight the correct existing destination", () => {
  assert.equal(navHighlight("home", false), "models");
  assert.equal(navHighlight("home", true), "org-overview");
  assert.equal(navHighlight("build", false), "api-key");
  assert.equal(navHighlight("build", true), "org-keys");
  assert.equal(navHighlight("settings", false), "account");
  assert.equal(navHighlight("rewards", false), "usage");
  assert.equal(navHighlight("org-invoices", true), "org-invoices");
});
