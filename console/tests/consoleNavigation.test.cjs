const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadTs(relativePath, requireFn = undefined) {
  const source = fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: result.exports,
    module: result,
    ...(requireFn ? { require: requireFn } : {}),
  });
  return result.exports;
}

const sections = loadTs("src/lib/consoleSections.ts");
const nav = loadTs("src/lib/consoleNavigation.ts", (id) => {
  if (id === "./consoleSections") return sections;
  throw new Error("Unexpected navigation dependency: " + id);
});
const { PERSONAL_GROUPS, PERSONAL_MORE, PERSONAL_DOCK, ORG_WORK,
  ORG_MANAGE, ORG_BUILD, ORG_ACCOUNT, ORG_MORE,
  ORG_DOCK, ORG_READ_ONLY_DOCK, navHighlight } = nav;

const ids = (items) => Array.from(items, (item) => item.id);
const groupIds = (groups) => groups.flatMap((group) => ids(group.items));

test("personal navigation retains the original grouped structure", () => {
  assert.deepEqual(Array.from(PERSONAL_GROUPS, (g) => g.title),
    ["Account", "Organization", "Explore", "Build", "Access"]);
  const direct = groupIds(PERSONAL_GROUPS);
  for (const id of ["account", "billing", "organizations", "models", "playground",
    "deploy", "rewards", "agents", "buckets", "api-key", "usage", "mcp", "shield",
    "authorized-apps"]) assert.ok(direct.includes(id), id + " must be directly visible");
  assert.equal(new Set(direct).size, direct.length, "no duplicate sidebar links");
});

test("MCP is direct in both workspace types, only reference pages are tucked away", () => {
  assert.ok(ids(PERSONAL_GROUPS.find((g) => g.title === "Build").items).includes("mcp"));
  assert.ok(ids(ORG_BUILD).includes("mcp"));
  assert.ok(!ids(PERSONAL_MORE).includes("mcp"));
  assert.ok(!ids(ORG_MORE).includes("mcp"));
  assert.deepEqual(ids(PERSONAL_MORE), ["payg-api", "gen-api"]);
  assert.deepEqual(ids(ORG_MORE), ["payg-api", "gen-api"]);
});

test("organization sidebar restores every role-filterable management destination in original order", () => {
  assert.deepEqual(ids(ORG_MANAGE), Array.from(sections.ORG_SECTION_ORDER));
  for (const id of sections.ORG_SECTION_ORDER) {
    assert.ok(nav.ORG_MANAGE.some((item) => item.id === id && item.label === sections.ORG_SECTION_META[id].label));
  }
  assert.deepEqual(ids(ORG_WORK), ["models", "playground", "agents", "buckets"]);
  assert.deepEqual(ids(ORG_BUILD), ["deploy", "mcp", "shield"]);
  assert.deepEqual(ids(ORG_ACCOUNT), ["account", "organizations"]);
  assert.equal(new Set([...ids(ORG_WORK), ...ids(ORG_MANAGE), ...ids(ORG_BUILD), ...ids(ORG_ACCOUNT)]).size,
    ORG_WORK.length + ORG_MANAGE.length + ORG_BUILD.length + ORG_ACCOUNT.length);
  assert.equal(sections.orgSectionAllowed("org-security", "auditor"), false);
  assert.equal(sections.orgSectionAllowed("org-usage", "auditor"), true);
});

test("Home link is available without changing the original navigation groups", () => {
  assert.equal(nav.HOME_ITEM.id, "home");
  assert.ok(!groupIds(PERSONAL_GROUPS).includes("home"));
});

test("mobile retains role-appropriate direct shortcuts plus More", () => {
  assert.deepEqual(ids(PERSONAL_DOCK), ["playground", "models", "api-key", "usage"]);
  assert.deepEqual(ids(ORG_DOCK), ["playground", "models", "org-keys", "org-usage"]);
  assert.deepEqual(ids(ORG_READ_ONLY_DOCK), ["org-overview", "org-keys", "org-usage", "org-members"]);
});

test("old URLs still highlight actual feature pages", () => {
  assert.equal(navHighlight("home", false), "home");
  assert.equal(navHighlight("home", true), "home");
  assert.equal(navHighlight("build", false), "api-key");
  assert.equal(navHighlight("build", true), "org-keys");
  assert.equal(navHighlight("settings", false), "account");
  assert.equal(navHighlight("rewards", false), "rewards");
  assert.equal(navHighlight("org-invoices", true), "org-invoices");
});
