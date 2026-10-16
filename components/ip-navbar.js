class IpNavbar extends HTMLElement {
	connectedCallback() {
		const active = this.getAttribute("active") || "";
		const on = (...ids) => (ids.includes(active) ? " active" : "");
		const MARK = `<svg class="ipn-mark" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1" y="1" width="16" height="16" stroke="#0b0f1a" stroke-width="1.5"/><path d="M5 13V5m4 8V5m4 8V9" stroke="#4f7cff" stroke-width="1.8"/></svg>`;
		const CARET = `<svg class="ipn-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.5"/></svg>`;

		this.innerHTML = `
<header class="ipn" id="ipn">
	<div class="ipn-bar">
		<a class="ipn-brand" href="/index.html" aria-label="InferencePort AI home">${MARK}<span>InferencePort <em>AI</em></span></a>
		<button class="ipn-burger" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="ipn-panel"><span></span></button>
		<div class="ipn-panel" id="ipn-panel">
			<ul class="ipn-links">
				<li class="ipn-item">
					<button class="ipn-link ipn-dd${on("platform", "install", "lightning", "shield", "solutions")}" type="button" aria-expanded="false">Platform ${CARET}</button>
					<div class="ipn-menu">
						<a class="ipn-m" href="/platform.html"><i class="dot-shield"></i><div><b>How it all fits together</b><span>App, Console and Organizations — one account, one map.</span></div></a>
						<a class="ipn-m" href="/install.html"><i class="dot-app"></i><div><b>Desktop App</b><span>Local models, self-hosted servers, tools. Runs on your hardware.</span></div></a>
						<a class="ipn-m" href="/lightning.html"><i class="dot-chat"></i><div><b>Lightning Chat</b><span>Hosted chat at up to 1,000 words/sec, in the app or browser.</span></div></a>
						<a class="ipn-m" href="/console"><i class="dot-console"></i><div><b>Developer Console</b><span>API keys, Pay-to-Go credits, usage, playground, Shield.</span></div></a>
						<a class="ipn-m" href="/platform.html#organizations"><i class="dot-org"></i><div><b>Organizations</b><span>Shared wallet, SSO, policies and audit for your whole team.</span></div></a>
						<a class="ipn-m" href="/shield.html"><i class="dot-shield"></i><div><b>AI Shield</b><span>One call, one decision: fraud and abuse detection.</span></div></a>
					</div>
				</li>
				<li><a class="ipn-link${on("marketplace")}" href="/marketplace.html">Models</a></li>
				<li><a class="ipn-link${on("pricing")}" href="/pricing.html">Pricing</a></li>
				<li><a class="ipn-link${on("security")}" href="/security.html">Security</a></li>
				<li><a class="ipn-link" href="https://docs.inferenceport.ai" target="_blank" rel="noopener">Docs</a></li>
			</ul>
			<div class="ipn-right">
				<a class="ipn-ghost" href="/console">Open Console</a>
				<a class="ipn-cta" href="/install.html#install">Download app</a>
			</div>
		</div>
	</div>
</header>
<script data-goatcounter="https://ipai.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
`;
		const root = this.querySelector("#ipn");
		const burger = this.querySelector(".ipn-burger");
		burger.addEventListener("click", () => {
			const open = root.classList.toggle("open");
			burger.setAttribute("aria-expanded", String(open));
		});
		const dd = this.querySelector(".ipn-dd");
		const item = dd.closest(".ipn-item");
		dd.addEventListener("click", () => {
			const open = item.classList.toggle("open");
			dd.setAttribute("aria-expanded", String(open));
		});
		document.addEventListener("click", (e) => {
			if (!item.contains(e.target)) {
				item.classList.remove("open");
				dd.setAttribute("aria-expanded", "false");
			}
		});
		item.addEventListener("keydown", (e) => {
			if (e.key === "Escape") { item.classList.remove("open"); dd.setAttribute("aria-expanded", "false"); dd.focus(); }
		});
	}
}

customElements.define("ip-navbar", IpNavbar);
