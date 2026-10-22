class IpFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
<footer class="ipf">
	<div class="ipf-top">
		<div>
			<span class="ipf-brand"><svg width="16" height="28" viewBox="170 30 320 565" fill="#FCD704" aria-hidden="true"><path d="M320 45h145L352 233h121L183 580l105-252H183z"/></svg>InferencePort <em>AI</em></span>
			<p class="ipf-blurb">Run models on your hardware, in our cloud, or both — governed from a single account and a single console.</p>
		</div>
		<div>
			<h4>Build</h4>
			<ul>
				<li><a href="/index.html#api">Pay-to-Go API</a></li>
				<li><a href="/index.html#agents">Managed Agents</a></li>
				<li><a href="/index.html#council">Council MCP</a></li>
				<li><a href="/ipx.html">ipx CLI</a></li>
				<li><a href="/console">Developer Console</a></li>
			</ul>
		</div>
		<div>
			<h4>Run &amp; protect</h4>
			<ul>
				<li><a href="/index.html#deploy">Model Deployments</a></li>
				<li><a href="/install.html">Desktop App</a></li>
				<li><a href="/lightning.html">Lightning Chat</a></li>
				<li><a href="/shield.html">AI Shield</a></li>
				<li><a href="/platform.html#organizations">Organizations</a></li>
			</ul>
		</div>
		<div>
			<h4>Company</h4>
			<ul>
				<li><a href="/pricing.html">Pricing</a></li>
				<li><a href="/marketplace.html">Model catalog</a></li>
				<li><a href="/platform.html">Platform guide</a></li>
				<li><a href="/security.html#security">Security</a></li>
				<li><a href="/security.html#privacy">Privacy Policy</a></li>
				<li><a href="/security.html#terms">Terms of Service</a></li>
				<li><a href="/security.html#refunds">Refund Policy</a></li>
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
