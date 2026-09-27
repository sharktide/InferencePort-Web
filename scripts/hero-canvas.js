/* ── Interactive hero constellation canvas ──
   Adds a mouse-reactive particle network behind the hero content
   of every page that has a hero (.hero-section / .page-hero / .hero). */
(function () {
	const SELECTOR = ".hero-section, .page-hero, .hero";
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

	function init(hero) {
		if (hero.dataset.heroCanvas) return;
		hero.dataset.heroCanvas = "1";
		if (reduced.matches) return;

		const canvas = document.createElement("canvas");
		canvas.className = "hero-canvas";
		canvas.setAttribute("aria-hidden", "true");
		hero.insertBefore(canvas, hero.firstChild);

		const ctx = canvas.getContext("2d");
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const mouse = { x: -9999, y: -9999 };
		let w = 0, h = 0, particles = [], running = false, raf = null;

		function resize() {
			w = hero.clientWidth;
			h = hero.clientHeight;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			canvas.style.width = w + "px";
			canvas.style.height = h + "px";
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			const target = Math.max(30, Math.min(90, Math.round((w * h) / 14000)));
			while (particles.length < target) particles.push(spawn());
			particles.length = target;
		}

		function spawn() {
			return {
				x: Math.random() * w,
				y: Math.random() * h,
				vx: (Math.random() - 0.5) * 0.35,
				vy: (Math.random() - 0.5) * 0.35,
				r: Math.random() * 1.5 + 0.7
			};
		}

		function step() {
			ctx.clearRect(0, 0, w, h);
			for (const p of particles) {
				const dx = p.x - mouse.x, dy = p.y - mouse.y;
				const d2 = dx * dx + dy * dy;
				if (d2 < 20000 && d2 > 1) {
					const d = Math.sqrt(d2);
					const f = (1 - d2 / 20000) * 0.05;
					p.vx += (dx / d) * f;
					p.vy += (dy / d) * f;
				}
				p.vx *= 0.99;
				p.vy *= 0.99;
				const sp = Math.hypot(p.vx, p.vy);
				if (sp > 1.2) { p.vx = (p.vx / sp) * 1.2; p.vy = (p.vy / sp) * 1.2; }
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0) { p.x = 0; p.vx *= -1; }
				if (p.x > w) { p.x = w; p.vx *= -1; }
				if (p.y < 0) { p.y = 0; p.vy *= -1; }
				if (p.y > h) { p.y = h; p.vy *= -1; }
			}
			for (let i = 0; i < particles.length; i++) {
				const a = particles[i];
				for (let j = i + 1; j < particles.length; j++) {
					const b = particles[j];
					const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
					if (d2 < 130 * 130) {
						ctx.strokeStyle = "rgba(79,124,255," + (0.22 * (1 - d2 / 16900)).toFixed(3) + ")";
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.moveTo(a.x, a.y);
						ctx.lineTo(b.x, b.y);
						ctx.stroke();
					}
				}
			}
			ctx.fillStyle = "rgba(79,124,255,0.55)";
			for (const p of particles) {
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fill();
			}
			if (running) raf = requestAnimationFrame(step);
		}

		hero.addEventListener("pointermove", (e) => {
			const r = hero.getBoundingClientRect();
			mouse.x = e.clientX - r.left;
			mouse.y = e.clientY - r.top;
		});
		hero.addEventListener("pointerleave", () => { mouse.x = -9999; mouse.y = -9999; });
		window.addEventListener("resize", resize);

		new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				running = entry.isIntersecting;
				if (running) {
					resize();
					raf = requestAnimationFrame(step);
				} else if (raf) {
					cancelAnimationFrame(raf);
					raf = null;
				}
			});
		}, { threshold: 0 }).observe(hero);

		resize();
	}

	function start() {
		document.querySelectorAll(SELECTOR).forEach(init);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
