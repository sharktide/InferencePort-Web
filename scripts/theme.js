/* Marketing site theme preference (separate from console-theme).
   Synchronous head script prevents a flash of the wrong appearance. */
(function () {
  "use strict";
  const key = "site-theme";
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
    return saved() || (system && system.matches ? "dark" : "light");
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

  function toggle() {
    const theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { window.localStorage.setItem(key, theme); } catch { /* Still toggle for this visit. */ }
    apply(theme);
  }

  window.InferencePortSiteTheme = { toggle, syncButtons };
  apply(preferred());

  function onSystemChange() { if (!saved()) apply(preferred()); }
  if (system) {
    if (system.addEventListener) system.addEventListener("change", onSystemChange);
    else if (system.addListener) system.addListener(onSystemChange);
  }
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) apply(preferred());
  });
})();
