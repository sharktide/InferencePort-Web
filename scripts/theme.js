/*
Copyright 2025 Rihaan Meher

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* Marketing site theme preference (separate from console-theme).
   Synchronous head script prevents a flash of the wrong appearance. */
(function () {
  "use strict";
  const key = "site-theme";
  let inMemoryChoice = null; // Explicit choice for sessions where storage is blocked.
  const root = document.documentElement;
  const system = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function saved() {
    try {
      const value = window.localStorage.getItem(key);
      return value === "dark" || value === "light" ? value : null;
    } catch {
      return null;
    }
  }

  function preferred() {
    return saved() || inMemoryChoice || (system && system.matches ? "dark" : "light");
  }

  function syncButtons() {
    const dark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-site-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  function apply(value) {
    const theme = value === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-bs-theme", theme);
    root.style.colorScheme = theme;
    syncButtons();
    document.dispatchEvent(new CustomEvent("ip-theme-change", { detail: { theme } }));
  }

  function performToggle() {
    // Read the latest shared preference, not the possibly stale tab DOM.
    const current = saved() || inMemoryChoice || root.getAttribute("data-theme");
    const theme = current === "dark" ? "light" : "dark";
    inMemoryChoice = theme;
    try { window.localStorage.setItem(key, theme); } catch { /* Keep the in-memory choice. */ }
    apply(theme);
  }

  function toggle() {
    // Where supported, serialize cross-tab read/modify/write to prevent lost
    // toggles. Older browsers still re-read storage before every toggle.
    const locks = window.navigator && window.navigator.locks;
    if (locks && typeof locks.request === "function") {
      let entered = false;
      try {
        return locks.request("inferenceport-site-theme", () => {
          entered = true;
          performToggle();
        }).catch(() => { if (!entered) performToggle(); });
      } catch {
        return performToggle();
      }
    }
    return performToggle();
  }

  window.InferencePortSiteTheme = { toggle, syncButtons };
  apply(preferred());

  function onSystemChange() { if (!saved() && !inMemoryChoice) apply(preferred()); }
  if (system) {
    if (system.addEventListener) system.addEventListener("change", onSystemChange);
    else if (system.addListener) system.addListener(onSystemChange);
  }
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      inMemoryChoice = null;
      apply(preferred());
    }
  });
})();
