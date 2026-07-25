/* ═══════════════════════════════════════════════════
   InferencePort AI — Scroll Reveal Animations
   ═══════════════════════════════════════════════════ */

(function () {
	"use strict";

	function initReveal() {
		const elements = document.querySelectorAll(".reveal");
		if (!elements.length) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add("visible");
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.1,
				rootMargin: "0px 0px -40px 0px",
			}
		);

		elements.forEach((el) => observer.observe(el));
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initReveal);
	} else {
		initReveal();
	}
})();
