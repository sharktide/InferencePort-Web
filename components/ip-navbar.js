class IpNavbar extends HTMLElement {
	connectedCallback() {
		const active = this.getAttribute("active") || "";
		const on = (...ids) => (ids.includes(active) ? " active" : "");
		const IC = {
		api: `<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>`,
		agents: `<rect x="4" y="8" width="16" height="11"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/>`,
		council: `<circle cx="12" cy="6" r="2.6"/><circle cx="5.5" cy="17" r="2.6"/><circle cx="18.5" cy="17" r="2.6"/><path d="M10.6 8.4L7 14.5M13.4 8.4L17 14.5M8.2 17h7.6"/>`,
		deploy: `<rect x="3" y="4" width="18" height="6"/><rect x="3" y="14" width="18" height="6"/><path d="M7 7h.01M7 17h.01"/>`,
		cli: `<rect x="3" y="4" width="18" height="16"/><path d="M7 9l3 3-3 3M12 15h5"/>`,
		app: `<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/>`,
		chat: `<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>`,
		catalog: `<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>`,
		shield: `<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
		orgs: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5.5a3 3 0 010 5.8M18 14.5c1.9.8 3 2.8 3 5.5"/>`,
		console: `<rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M13 9h5M13 14h5"/>`,
	};
		const mi = (href, ic, cls, title, desc) => `<a class="ipn-m ${cls}" href="${href}"><span class="ipn-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${IC[ic]}</svg></span><div><b>${title}</b><span>${desc}</span></div></a>`;
		const MARK = `<svg class="ipn-mark" viewBox="170 30 320 565" fill="#FCD704" aria-hidden="true"><path d="M320 45h145L352 233h121L183 580l105-252H183z"/></svg>`;
		const CARET = `<svg class="ipn-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 3l4 4 4-4" stroke="currentColor" stroke-width="1.5"/></svg>`;

		this.innerHTML = `
<header class="ipn" id="ipn">
	<div class="ipn-bar">
		<a class="ipn-brand" href="/index.html" aria-label="InferencePort AI home">${MARK}<span>InferencePort <em>AI</em></span></a>
		<button class="ipn-burger" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="ipn-panel"><span></span></button>
		<div class="ipn-panel" id="ipn-panel">
			<ul class="ipn-links">
				<li class="ipn-item">
					<button class="ipn-link ipn-dd${on("platform", "install", "lightning", "shield", "solutions")}" type="button" aria-expanded="false">Products ${CARET}</button>
					<div class="ipn-menu">
						<div class="ipn-mega">
							<div class="ipn-col"><h5>Build</h5>
								${mi("/index.html#api","api","c-api","Pay-to-Go API","One OpenAI-compatible endpoint for text, image, video, audio, 3D, embeddings and realtime voice.")}
								${mi("/index.html#agents","agents","c-console","Managed Agents","Host agents on your prompt, model and MCP tools. Call them like a model.")}
								${mi("/index.html#council","council","c-console","Council MCP","A council of models, cross-reviewed into one answer, inside any MCP client.")}
								${mi("/ipx.html","cli","c-api","ipx CLI","Scan, check and automate from your terminal and CI.")}
							</div>
							<div class="ipn-col"><h5>Run</h5>
								${mi("/index.html#deploy","deploy","c-org","Model Deployments","Deploy any open model on demand and use it from the API.")}
								${mi("/install.html","app","c-app","Desktop App","Local models, self-hosted servers and tools on your own hardware.")}
								${mi("/lightning.html","chat","c-chat","Lightning Chat","Hosted chat at up to 1,000 words/sec in the app or browser.")}
								${mi("/marketplace.html","catalog","c-app","Model Catalog","Every cloud and local model across five modalities.")}
							</div>
							<div class="ipn-col"><h5>Protect &amp; manage</h5>
								${mi("/shield.html","shield","c-shield","AI Shield","Fraud, abuse and prompt-attack detection in one call.")}
								${mi("/platform.html#organizations","orgs","c-org","Organizations","Shared wallet, SSO, policy, budgets and audit for your team.")}
								${mi("/console","console","c-console","Developer Console","Keys, credits, usage, playground and agents in the browser.")}
								<a class="ipn-all" href="/platform.html">How it all fits together &rarr;</a>
							</div>
						</div>
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
