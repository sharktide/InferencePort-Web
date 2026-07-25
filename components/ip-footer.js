class IpFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
<footer>
	<div class="container">
		<div class="footer-inner d-flex flex-wrap justify-content-between align-items-center gap-3">
			<span>&copy; 2026 Rihaan Meher | <a href="https://stats.uptimerobot.com/N1MpjMQC4U" target="_blank" rel="noopener">System Health</a></span>
			<div class="footer-links">
				<a href="marketplace.html">Marketplace</a>
				<a href="lightning.html">Lightning</a>
				<a href="solutions.html">Solutions</a>
				<a href="install.html">Install</a>
				<a href="pricing.html">Pricing</a>
				<a href="shield.html">Shield</a>
				<a href="security.html">Security</a>
				<a href="https://inferenceport-ai.readthedocs.io" target="_blank" rel="noopener">Docs</a>
				<a href="privacy.html">Privacy</a>
				<a href="terms.html">Terms</a>
				<a href="feedback.html">Feedback</a>
			</div>
		</div>
	</div>
</footer>
`;
	}
}

customElements.define("ip-footer", IpFooter);
