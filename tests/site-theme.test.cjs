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

test("dark-mode yellow highlights and box headers use readable, muted text", () => {
  const site = fs.readFileSync(path.join(root, "styles/site.css"), "utf8");
  const shared = fs.readFileSync(path.join(root, "styles/shared.css"), "utf8");
  assert.match(site, /:root\[data-theme="dark"\] \.hx h1 em,/);
  assert.match(site, /color: #282d36;\s+background: var\(--gold\);/);
  assert.match(site, /:root\[data-theme="dark"\] \.pc h3,/);
  assert.match(site, /:root\[data-theme="dark"\] \.panel-h,/);
  assert.match(site, /background: #252b34;\s+border-bottom-color: var\(--border\);\s+color: #c0cad7;/);
  assert.match(shared, /:root\[data-theme="dark"\] \.hero-title \.accent,/);
  assert.match(shared, /color: #282d36 !important;/);

  // Contrast checks for the two explicit dark-mode color pairings.
  function luminance(hex) {
    const channels = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
    return channels.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrast(first, second) {
    const [bright, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (bright + 0.05) / (dark + 0.05);
  }
  assert.ok(contrast("#282d36", "#fcd704") >= 7, "highlight ink must contrast with yellow");
  assert.ok(contrast("#c0cad7", "#252b34") >= 7, "panel header text must contrast with slate");
});
