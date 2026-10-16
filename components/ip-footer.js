class IpFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
<footer class="ipf">
	<div class="ipf-top">
		<div>
			<span class="ipf-brand"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1" y="1" width="16" height="16" stroke="#fff" stroke-width="1.5"/><path d="M5 13V5m4 8V5m4 8V9" stroke="#4f7cff" stroke-width="1.8"/></svg>InferencePort <em>AI</em></span>
			<p class="ipf-blurb">Run models on your hardware, in our cloud, or both — governed from a single account and a single console.</p>
		</div>
		<div>
			<h4>Surfaces</h4>
			<ul>
				<li><a href="/platform.html">How it fits together</a></li>
				<li><a href="/install.html">Desktop App</a></li>
				<li><a href="/lightning.html">Lightning Chat</a></li>
				<li><a href="/console">Developer Console</a></li>
				<li><a href="/platform.html#organizations">Organizations</a></li>
			</ul>
		</div>
		<div>
			<h4>Products</h4>
			<ul>
				<li><a href="/shield.html">AI Shield</a></li>
				<li><a href="/marketplace.html">Model catalog</a></li>
				<li><a href="/tools.html">Tool Registry</a></li>
			</ul>
		</div>
		<div>
			<h4>Company</h4>
			<ul>
				<li><a href="/pricing.html">Pricing</a></li>
				<li><a href="/security.html">Security</a></li>
				<li><a href="/security.html">Privacy &amp; Terms</a></li>
				<li><a href="mailto:feedback@inferenceport.ai">Contact</a></li>
			</ul>
		</div>
		<div>
			<h4>Resources</h4>
			<ul>
				<li><a href="https://docs.inferenceport.ai" target="_blank" rel="noopener">Documentation</a></li>
				<li><a href="https://stats.uptimerobot.com/N1MpjMQC4U" target="_blank" rel="noopener">System health</a></li>
				<li><a href="https://github.com/sharktide/inferenceport-ai" target="_blank" rel="noopener">GitHub</a></li>
			</ul>
		</div>
	</div>
	<div class="ipf-bottom">
		<span>&copy; 2026 InferencePort LLC. InferencePort AI&trade; is a trademark of InferencePort LLC. All rights reserved.</span>
		<span><a href="https://stats.uptimerobot.com/N1MpjMQC4U" target="_blank" rel="noopener">All systems &rarr; status</a></span>
	</div>
</footer>
`;
	}
}

customElements.define("ip-footer", IpFooter);
