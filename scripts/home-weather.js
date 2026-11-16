/**
 * Atmospheric margins for wide-screen homepage layouts.
 *
 * Decorative, pointer-transparent and progressive enhancement only.
 * CSS perspective gives the layered cloud forms depth without a second
 * WebGL context or another animation library competing with the hero.
 * Scroll position controls drift and the active product influences weather:
 * Buckets -> rain; Shield -> charged air; Lightning chat -> soft electric glow.
 */
(() => {
  "use strict";
  const root = document.getElementById("lp-weather");
  if (!root) return;

  const desktop = window.matchMedia("(min-width: 1480px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const anchors = [
    { id: "buckets", phase: "rain" },
    { id: "shield", phase: "charged" },
    { id: "lightning", phase: "electric" }
  ];
  let pending = false;
  let active = false;
  const rail = side => {
    const right = side === "right";
    const id = right ? "r" : "l";
    return `
      <div class="lp-weather-rail lp-weather-rail--${side}">
        <div class="lp-weather-scene">
          <svg class="lp-weather-art" viewBox="0 0 230 610"
            xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="lp-cloud-${id}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#a4bace" stop-opacity=".45"/>
                <stop offset=".55" stop-color="#d4e2ea" stop-opacity=".2"/>
                <stop offset="1" stop-color="#7793b1" stop-opacity=".06"/>
              </linearGradient>
              <linearGradient id="lp-drop-${id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#7daaca" stop-opacity="0"/>
                <stop offset=".5" stop-color="#7daaca" stop-opacity=".64"/>
                <stop offset="1" stop-color="#7daaca" stop-opacity="0"/>
              </linearGradient>
              <linearGradient id="lp-spark-${id}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#dfbd6b" stop-opacity=".16"/>
                <stop offset=".5" stop-color="#d6a944" stop-opacity=".85"/>
                <stop offset="1" stop-color="#fff0b5" stop-opacity=".29"/>
              </linearGradient>
            </defs>
            <g class="lp-weather-far">
              <path d="M-44 226 C-42 180 -7 154 42 159 C53 123 89 109 122 123 C138 86 201 95 207 140 C239 140 257 163 255 186 C260 230 209 245 173 237 C133 257 105 248 78 235 C31 254 -3 248 -44 226Z"
                    fill="url(#lp-cloud-${id})"/>
              <path d="M-38 240 C25 266 80 250 117 245 C166 258 208 252 250 232" stroke="#9ab4cc" stroke-opacity=".21" stroke-width="1.2" fill="none"/>
            </g>
            <g class="lp-weather-near">
              <path d="M-35 338 C-32 305 -3 288 30 291 C42 257 71 246 99 254 C116 216 170 218 183 248 C221 245 250 273 252 308 C263 337 223 357 187 352 C153 372 116 366 86 351 C39 363 1 359 -35 338Z"
                    fill="url(#lp-cloud-${id})" stroke="#90acc4" stroke-opacity=".19" stroke-width="1"/>
            </g>
            <g class="lp-weather-rain">
              <path d="M29 370l-9 30 M60 391l-11 38 M103 377l-10 37 M140 399l-8 32 M183 378l-9 32 M213 400l-10 36
                       M42 443l-8 29 M81 453l-9 37 M117 438l-9 35 M164 452l-11 39 M203 455l-9 31
                       M25 510l-8 27 M90 515l-10 34 M151 514l-8 29"
                    stroke="url(#lp-drop-${id})" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            </g>
            <g class="lp-weather-charge">
              <path d="M120 307L91 388H118L97 479L180 360H143L163 307Z"
                    fill="url(#lp-spark-${id})" stroke="#e0b757" stroke-opacity=".7" stroke-width="1.2" stroke-linejoin="round"/>
              <path d="M85 376L68 393M184 387l17-8" stroke="#d8b35e" stroke-opacity=".28" stroke-width="1.4"/>
            </g>
            <g class="lp-weather-water" fill="none" stroke="#78afc9" stroke-width="1.3">
              <path d="M-5 534C40 517 64 554 112 535S181 523 237 537" opacity=".33"/>
              <path d="M-7 552C42 535 70 576 121 553S183 541 237 558" opacity=".24"/>
              <path d="M-10 573C43 557 77 593 126 573S197 556 244 578" opacity=".17"/>
            </g>
          </svg>
        </div>
      </div>`;
  };

  function near(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const bounds = el.getBoundingClientRect();
    const center = window.innerHeight * 0.54;
    return bounds.top < center + window.innerHeight * 0.23 &&
      bounds.bottom > center - window.innerHeight * 0.23;
  }

  function draw() {
    pending = false;
    if (!active) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const shift = Math.sin(y * 0.00115) * 23;
    const twist = Math.sin(y * 0.00073) * 7;
    root.style.setProperty("--weather-shift", `${shift.toFixed(2)}px`);
    root.style.setProperty("--weather-shift-right", `${(-shift * .8).toFixed(2)}px`);
    root.style.setProperty("--weather-twist", `${twist.toFixed(2)}deg`);
    root.style.setProperty("--weather-twist-right", `${(-twist).toFixed(2)}deg`);
    const phase = anchors.find(item => near(item.id));
    root.dataset.phase = phase?.phase || "cloud";
  }
  function schedule() {
    if (pending || !active) return;
    pending = true;
    window.requestAnimationFrame(draw);
  }
  function measureGutters() {
    // The homepage content column changes slightly across viewport sizes.
    // Never let the decorative atmosphere touch the actual text/cards.
    const bounds = [...document.querySelectorAll(".lp .lp-wrap")]
      .map(node => node.getBoundingClientRect());
    const left = bounds.length ? Math.min(...bounds.map(rect => rect.left)) : 0;
    const right = bounds.length ? Math.min(...bounds.map(rect => window.innerWidth - rect.right)) : 0;
    const clamp = value => Math.max(0, Math.min(184, value - 34));
    root.style.setProperty("--weather-left-width", `${clamp(left).toFixed(2)}px`);
    root.style.setProperty("--weather-right-width", `${clamp(right).toFixed(2)}px`);
  }
  function reconcile() {
    const enabled = desktop.matches && !reduced.matches;
    if (!enabled) {
      active = false;
      root.classList.remove("is-active");
      root.replaceChildren();
      root.dataset.phase = "cloud";
      return;
    }
    measureGutters();
    if (!active) {
      // Static, trusted internal markup. No dynamic HTML input from visitors.
      root.innerHTML = rail("left") + rail("right");
      active = true;
      root.classList.add("is-active");
    }
    schedule();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", reconcile, { passive: true });
  desktop.addEventListener?.("change", reconcile);
  reduced.addEventListener?.("change", reconcile);
  reconcile();
})();
