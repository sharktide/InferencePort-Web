/** Lightweight DOM contract tests for the marketing site's theme preference. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "scripts/theme.js"), "utf8");

function harness({ stored = null, systemDark = false, blockedStorage = false } = {}) {
  const attrs = {};
  const buttonAttrs = {};
  const listeners = {};
  const mediaListeners = {};
  const writes = {};
  const pageEvents = [];
  const documentElement = {
    style: {},
    getAttribute: (name) => attrs[name] ?? null,
    setAttribute: (name, value) => { attrs[name] = value; },
  };
  const button = { setAttribute: (key, value) => { buttonAttrs[key] = value; } };
  const media = {
    matches: systemDark,
    addEventListener: (type, cb) => { mediaListeners[type] = cb; },
  };
  const localStorage = {
    getItem: () => {
      if (blockedStorage) throw new Error("Storage disabled");
      return stored;
    },
    setItem: (key, value) => {
      if (blockedStorage) throw new Error("Storage disabled");
      writes[key] = value;
      stored = value;
    },
  };
  const window = {
    localStorage,
    matchMedia: (query) => {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return media;
    },
    addEventListener: (type, cb) => { listeners[type] = cb; },
  };
  const document = {
    documentElement,
    querySelectorAll: (selector) => {
      assert.equal(selector, "[data-site-theme-toggle]");
      return [button];
    },
    dispatchEvent: (event) => { pageEvents.push(event); },
  };
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  vm.runInNewContext(script, { document, window, CustomEvent });
  return {
    attrs, buttonAttrs, writes, window, pageEvents,
    setStored(value) { stored = value; },
    setSystemDark(value) { media.matches = value; mediaListeners.change(); },
    onStorage(key) { listeners.storage({ key }); },
  };
}

test("follows OS preference without a saved override", () => {
  const light = harness();
  assert.equal(light.attrs["data-theme"], "light");
  assert.equal(light.attrs["data-bs-theme"], "light");
  assert.equal(light.buttonAttrs["aria-pressed"], "false");
  const dark = harness({ systemDark: true });
  assert.equal(dark.attrs["data-theme"], "dark");
  assert.equal(dark.buttonAttrs["aria-pressed"], "true");
  dark.setSystemDark(false);
  assert.equal(dark.attrs["data-theme"], "light");
});

test("manual theme wins, persists, and updates accessible state", () => {
  const h = harness({ systemDark: true, stored: "light" });
  assert.equal(h.attrs["data-theme"], "light");
  h.window.InferencePortSiteTheme.toggle();
  assert.equal(h.attrs["data-theme"], "dark");
  assert.equal(h.attrs["data-bs-theme"], "dark");
  assert.equal(h.writes["site-theme"], "dark");
  assert.equal(h.buttonAttrs["aria-pressed"], "true");
  assert.equal(h.buttonAttrs.title, "Switch to light mode");
  h.setSystemDark(false);
  assert.equal(h.attrs["data-theme"], "dark", "OS changes must not override an explicit choice");
  h.setStored("light");
  h.onStorage("site-theme");
  assert.equal(h.attrs["data-theme"], "light", "other tabs should synchronize");
  assert.equal(h.pageEvents.at(-1).detail.theme, "light");
});

test("storage-denied browsers can still switch appearance", () => {
  const h = harness({ systemDark: false, blockedStorage: true });
  assert.doesNotThrow(() => h.window.InferencePortSiteTheme.toggle());
  assert.equal(h.attrs["data-theme"], "dark");
});

test("all public-navbar pages initialize the theme before the navbar", () => {
  const pages = [
    "authcallback.html", "decision.html", "index.html", "install.html", "ipx.html",
    "lightning.html", "marketplace.html", "openapp.html", "platform.html", "pricing.html",
    "reset.html", "security.html", "shield.html", "tools.html", "verifyemail.html",
    "partnerships/pollinations.html",
  ];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    const themeTags = [...html.matchAll(/<script src="([^"]*scripts\/theme\.js)"><\/script>/g)];
    const navTags = [...html.matchAll(/<script src="([^"]*components\/ip-navbar\.js)"><\/script>/g)];
    assert.equal(themeTags.length, 1, page + " must include theme.js once");
    assert.equal(navTags.length, 1, page + " must include navbar once");
    assert.ok(themeTags[0].index < navTags[0].index, page + " must initialize appearance before nav");
  }
  assert.match(fs.readFileSync(path.join(root, "redirect.html"), "utf8"), /scripts\/theme\.js/);
  const navbar = fs.readFileSync(path.join(root, "components/ip-navbar.js"), "utf8");
  assert.match(navbar, /themeButton\("desktop"\)/);
  assert.match(navbar, /themeButton\("mobile"\)/);
});
