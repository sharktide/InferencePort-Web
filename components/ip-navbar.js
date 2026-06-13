class IpNavbar extends HTMLElement {
	connectedCallback() {
		const active = this.getAttribute("active") || "";
		const showSolutions = this.hasAttribute("show-solutions");
		const items = [
			{ id: "home", label: "Home", href: "index.html" },
			{ id: "marketplace", label: "Marketplace", href: "marketplace.html" },
			{ id: "lightning", label: "Lightning", href: "lightning.html" },
		];
		items.push({ id: "solutions", label: "Solutions", href: "solutions.html" });
		items.push(
			{ id: "install", label: "Install", href: "install.html" },
			{ id: "pricing", label: "Pricing", href: "pricing.html" },
			{ id: "security", label: "Security", href: "security.html" },
		);

		const navItems = items.map((item) =>
			`<li class="nav-item"><a class="nav-link${active === item.id ? " active" : ""}" href="${item.href}">${item.label}</a></li>`
		).join("");

		this.innerHTML = `
<nav class="navbar navbar-expand-lg sticky-top">
	<div class="container">
		<a class="navbar-brand" href="index.html">InferencePort<span>AI</span></a>
		<button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#ip-nav">
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="ip-nav">
			<ul class="navbar-nav ms-auto align-items-lg-center gap-1">
				${navItems}
				<li class="nav-item ms-1"><a class="nav-link nav-pill-chat" href="chat/">Chat Now</a></li>
				<li class="nav-item ms-2"><a class="nav-link nav-pill" href="install.html#install">Get Started</a></li>
			</ul>
		</div>
	</div>
</nav>`;
	}
}

customElements.define("ip-navbar", IpNavbar);
