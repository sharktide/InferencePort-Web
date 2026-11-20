/** Public homepage contracts: useful, verified examples and working navigation. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("index.html");
const css = read("styles/landing.css");
const navbar = read("components/ip-navbar.js");
const platform = read("platform.html");
const marketplace = read("marketplace.html");

test("every link from the shared navbar to the homepage has a stable anchor", () => {
  const ids = [...home.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "Homepage contains duplicate IDs");
  const targets = [...navbar.matchAll(/\/index\.html#([a-z-]+)/g)].map((match) => match[1]);
  for (const target of targets) assert.ok(ids.includes(target), "Missing navbar anchor #" + target);
  for (const anchor of ["api", "agents", "council", "cli", "deploy", "buckets", "catalog",
    "lightning", "app", "shield", "organizations", "console", "pricing", "products"]) {
    assert.ok(ids.includes(anchor), "Missing anchor #" + anchor);
  }
  assert.match(home, /href="#main-content"/);
  assert.match(home, /<main class="lp" id="main-content">/);
});

test("final API workbench offers all eight documented modalities", () => {
  const examples=[...home.matchAll(/<div class="lp-code-example"[^>]*data-example-panel="([^"]+)"[^>]*>[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g)];
  assert.equal(examples.length,8);
  const fields={
    text:["/v1/chat/completions","deepseek-v4.1-flash-1017","messages"],
    image:["/v1/images/generations","lightning-image-turbo","prompt"],
    video:["/v1/videos","wan-fast","prompt"],
    audio:["/v1/audio/generations",null,"prompt"],
    "3d":["/v1/3d/generations","tripoSR","image_urls"],
    embedding:["/v1/embeddings","text-embedding-3-small","input"],
    decision:["/v1/systemone","microsoft/decision-1","questions"]
  };
  for(const [,key,code] of examples){
    assert.ok(home.includes('data-example-tab="'+key+'"'));
    if(key==="realtime"){
      assert.match(code,/wss:\/\/api\.inferenceport\.ai\/v1\/realtime/);
      assert.match(code,/os\.environ\["IP_API_KEY"\]/);
      continue;
    }
    const [endpoint,model,field]=fields[key];
    assert.ok(code.includes("https://api.inferenceport.ai"+endpoint));
    assert.match(code,/Authorization: Bearer \$IP_API_KEY/);
    const body=JSON.parse(code.match(/-d '([\s\S]*?)'/)[1]);
    if(model)assert.equal(body.model,model);
    assert.ok(body[field],key+" must include "+field);
  }
  assert.ok(home.indexOf('id="quickstart"')>home.indexOf('id="pricing"'));
  assert.ok(home.indexOf('id="customers"')>home.indexOf('id="pricing"'));
  assert.doesNotMatch(home,/class="lp-hero-demo"/);
  assert.match(home,/event\.key === "ArrowRight"/);
  assert.match(home,/event\.key === "ArrowLeft"/);
  assert.match(home,/navigator\.clipboard\.writeText\(code\)/);
});
test("product sections link to usable next steps", () => {
  for (const fragment of [
    'href="/console/agents"', 'href="/console/buckets"', 'href="shield.html"',
    'href="ipx.html"', 'href="lightning.html"', 'href="install.html"',
    'href="platform.html#organizations"', 'href="marketplace.html"',
    'href="https://docs.inferenceport.ai/en/latest/api/buckets.html"',
  ]) assert.ok(home.includes(fragment), "Missing product entry point: " + fragment);
  for (const phrase of [
    "Managed agents", "MCP tools", "S3-compatible", "PREVIEW", "Security",
    "wan2.7-t2v", "API key", "Usage", "Buckets",
  ]) assert.ok(home.toLowerCase().includes(phrase.toLowerCase()), "Missing useful detail: " + phrase);
  assert.match(platform, /<b>Buckets \(Preview\)<\/b>/);
  assert.doesNotMatch(home, /agent\/acme\/support-bot|2 connected|\$18\.20 Spend/);
});

test("homepage has intentional layout variation and responsive themes", () => {
  const sectionCount = [...home.matchAll(/<section\b/g)].length;
  assert.ok(sectionCount <= 10, "Homepage has excessive sections");
  assert.match(home, /class="lp-modality-matrix"/);
  assert.match(home, /class="lp-product-grid"/);
  assert.match(home, /class="lp-proof-agent"/);
  assert.match(home, /class="lp-proof-pair"/);
  assert.match(home, /class="lp-proof-shield"/);
  assert.match(home, /class="lp-workspace-layout"/);
  assert.match(home, /class="lp-org-spec"/);
  assert.match(home, /class="lp-shield-schema lp-shield-demo"/);
  assert.equal([...home.matchAll(/class="lp-ecosystem-spotlight(?: lp-ecosystem-spotlight--reverse)?"/g)].length,4);
  assert.doesNotMatch(home, /class="checks"|class="pgrid"|class="pc c-/);
  assert.match(home, /href="styles\/shared\.css"/);
  assert.match(home, /href="styles\/landing\.css"/);
  assert.doesNotMatch(home, /href="styles\/site\.css"/);
  assert.match(css, /\.lp-code-example\[hidden\]\s*\{\s*display:none !important;/);
  assert.match(css, /@media \(max-width:900px\)/);
  assert.match(css, /@media \(max-width:630px\)/);
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--border\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.lp-code-tabs button:focus-visible/);
});

test("theme correctly switches the hero instead of forcing dark mode", () => {
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero \{/);
  assert.match(css, /background:#fafaf7;color:var\(--text-body\)/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero-copy h1/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-button-outline/);
  assert.match(css, /:root:not\(\[data-theme="dark"\]\) \.lp-hero-bottom/);
  assert.doesNotMatch(home, /class="lp-hero-overline"/);
});

test("specific infrastructure features remain discoverable in concise sections", () => {
  for (const term of [
    "HTTP or SSE tools", "Unlisted", "Owner- or caller-paid",
    "$0.50 per deployment", "model availability",
    "S3-compatible storage", "scoped, revocable SigV4 credentials",
    "risk_score", "confidence", "decision", "reasons",
    "SAML SSO", "allowed models and modalities",
    "API, deployment and storage charges",
    "1–3 review rounds", "OAuth or API key",
    "Ollama", "JSON output"
  ]) assert.ok(home.toLowerCase().includes(term.toLowerCase()), "Missing concrete capability: " + term);
});

test("every hosted model modality is prominent and opens its actual Marketplace filter", () => {
  const examples = {
    video: ["wan2.7-t2v"],
    audio: ["openai-tts-1"],
    "3d": ["trellis2"],
    realtime: ["gpt-realtime-2.1-mini"],
    text: ["deepseek-v4.1-flash-1017"],
    image: ["lightning-image-turbo"],
    embedding: ["text-embedding-3-small"],
    decision: ["microsoft/decision-1"],
  };
  assert.equal([...home.matchAll(/class="lp-modality-row"/g)].length, 8,
    "All eight modalities should use the same presentation");
  for (const [type, ids] of Object.entries(examples)) {
    const href = 'href="marketplace.html?modality=' + type + '"';
    assert.ok(home.includes(href), "Missing category link for " + type);
    assert.ok(home.includes('data-modality="' + type + '"'), "Missing category marker for " + type);
    for (const id of ids) assert.ok(home.includes(id), "Missing real model example: " + id);
    assert.ok(marketplace.includes('"' + type + '"'), "Market category unavailable: " + type);
  }
  assert.match(marketplace, /permittedModalities\.has\(requestedModality\)/);
  assert.match(marketplace, /tab\.classList\.toggle\("active", tab === selected\)/);
  assert.match(marketplace, /nextUrl\.searchParams\.set\("modality", activeFilter\)/);
  assert.match(marketplace, /window\.history\.replaceState\(/);
});

test("desktop modules have intentional spacing with tablet and mobile fallbacks", () => {
  assert.match(css, /@media \(min-width:1101px\)/);
  assert.match(css, /\.lp-proof-agent \{[^}]*grid-template-columns:/);
  assert.match(css, /\.lp-proof-pair \{display:flex;flex-direction:column;/);
  assert.match(css, /\.lp-workspace-layout \{[^}]*grid-template-columns:/);
  assert.match(css, /\.lp-proof-agent,\.lp-proof-shield,\.lp-proof-pair,\.lp-workspace-layout \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.lp-modality-matrix \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.lp-product-grid \{ grid-template-columns:1fr;/);
});

test("full product directory restores all twelve destinations without decorative marketing cards", () => {
  const cards = [...home.matchAll(/<a class="lp-product-card" href="(#.*?)">/g)];
  assert.equal(cards.length, 12, "Expected twelve distinct product links");
  const groups = [...home.matchAll(/class="lp-product-group-heading"/g)];
  assert.equal(groups.length, 3, "Expected Build, Deploy & run, Protect & manage groups");
  for (const group of ["Build", "Deploy &amp; run", "Protect &amp; manage"]) {
    assert.ok(home.includes("<h3>" + group + "</h3>"), "Missing product group " + group);
  }
  const ids = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = cards.map(m => m[1].slice(1));
  assert.equal(new Set(hrefs).size, 12, "Each card should have its own destination");
  for (const target of hrefs) assert.ok(ids.has(target), "Broken product-card anchor #" + target);
  assert.equal([...home.matchAll(/class="lp-product-icon"/g)].length, 12,
    "Each product should have a compact, monochrome icon");
  assert.match(css, /\.lp-product-card:hover \{[^}]*border-color:var\(--lp-group-line\)/);
  assert.doesNotMatch(css, /\.lp-product-card:hover \{[^}]*box-shadow/);
});

test("homepage follows the 7-part hierarchy with restrained group accents", () => {
  const hero = home.indexOf('class="lp-hero"');
  const products = home.indexOf('class="lp-section lp-products" id="products"');
  const api = home.indexOf('class="lp-section lp-models" id="api"');
  const details = home.indexOf('class="lp-section lp-stack" id="platform-details"');
  const workspace = home.indexOf('class="lp-section lp-workflow"');
  const ecosystem = home.indexOf('class="lp-section lp-more"');
  const pricing = home.indexOf('class="lp-section lp-pricing"');
  assert.ok(hero >= 0 && hero < products && products < api && api < details
    && details < workspace && workspace < ecosystem && ecosystem < pricing,
    "Expected Hero → Products → Eight modalities → Featured → Workspace → Ecosystem → Pricing");
  for (const group of ["build", "run", "manage"]) {
    assert.match(home, new RegExp('class="lp-product-group lp-product-group--' + group + '"'));
    assert.ok(css.includes(".lp-product-group--" + group + " {"), "Missing scoped group palette: " + group);
  }
  assert.match(css, /\.lp-product-symbol \{[^}]*background:var\(--lp-group-dim\)/);
  assert.match(css, /\.lp-product-card:first-child \{[^}]*border-top:2px solid var\(--lp-group-line\)/);
  assert.match(css, /\.lp-modality-matrix \{[^}]*border-top:3px solid var\(--gold\)/);
  assert.doesNotMatch(css, /\.lp-product-card:hover \{[^}]*box-shadow/);
  assert.equal([...home.matchAll(/class="lp-product-card"/g)].length, 12);
  assert.equal([...home.matchAll(/class="lp-modality-row"/g)].length, 8);
});

test("product category icons match their labels", () => {
  const iconFor = (link) => home.match(new RegExp('<a class="lp-product-card" href="#' + link + '">[\\s\\S]*?(<svg[\\s\\S]*?<\\/svg>)'))?.[1] || "";
  assert.match(iconFor("buckets"), /m3 7 9-4 9 4-9 4-9-4Z/);
  assert.match(iconFor("lightning"), /M13 3L5 13\.5h6L10 21/);
  assert.match(iconFor("app"), /<rect x="3" y="4" width="18" height="12"/);
  assert.match(iconFor("catalog"), /M12 3l9 5-9 5-9-5z/);
});

test("proof panels show genuine control structures without pretending to be live data", () => {
  for (const term of [
    "Illustrative preview", "Backing model", "System instructions",
    "MCP servers", "Request billing", "Published", "Model deployments",
    "aws --endpoint-url", "POST /ai-shield/analyze",
    "Response fields", "Illustrative control layout"
  ]) assert.ok(home.includes(term), "Missing useful product proof: " + term);
  assert.match(home, /class="lp-proof-interface" aria-label="Illustration/);
  assert.doesNotMatch(home, /12\.4k Requests|\$18\.20 Spend|Customer logo|agent\/acme\/support-bot/);
});

test("console and organizations share one coherent workspace section", () => {
  const workspaceStart = home.indexOf('class="lp-section lp-workflow"');
  const workspaceEnd = home.indexOf('class="lp-section lp-more"', workspaceStart);
  const workspace = home.slice(workspaceStart, workspaceEnd);
  assert.match(workspace, /id="console"/);
  assert.match(workspace, /id="organizations"/);
  assert.match(workspace, /class="lp-workspace-console"/);
  assert.match(workspace, /class="lp-workspace-org"/);
  assert.match(workspace, /API, deployment and storage charges/);
  assert.match(workspace, /per-member and per-key limits/);
  assert.doesNotMatch(home.slice(home.indexOf('class="lp-section lp-stack"'), workspaceStart), /id="organizations"/);
});

test("pricing keeps distinct API, deployment, storage, and subscription billing", () => {
  for (const label of ["MODEL API", "DEPLOYMENTS", "BUCKETS", "CHAT &amp; TEAMS"]) {
    assert.ok(home.includes("<span>" + label + "</span>"), "Missing billing category " + label);
  }
  assert.match(home, /Storage, requests &amp; transfer/);
  assert.match(home, /Deployment fee \+ usage/);
  assert.match(home, /Model-specific usage/);
  assert.match(home, /Hosted chat subscriptions/);
});

test("architecture topology uses the exact InferencePort brand mark", () => {
  const js = read("scripts/home-topology.js");
  const navbar = read("components/ip-navbar.js");
  const canonical = "M320 45h145L352 233h121L183 580l105-252H183z";
  assert.ok(navbar.includes(canonical), "Expected canonical navbar mark");
  assert.ok(home.includes(canonical), "The static fallback must use the canonical mark");
  assert.ok(js.includes(canonical), "The 3D implementation must reference the canonical outline");
  assert.match(js, /const MARK_VERTICES = \[/);
  assert.match(js, /new THREE\.ExtrudeGeometry\(logoShape/);
  assert.match(js, /new THREE\.MeshPhysicalMaterial\(/);
  assert.match(js, /transmission:\.96/);
  assert.match(js, /clearcoat:1/);
  assert.match(js, /THREE\.EquirectangularReflectionMapping/);
  assert.match(js, /new THREE\.CanvasTexture\(pano\)/);
  assert.match(js, /renderer\.toneMappingExposure=1\.025/);
  assert.match(js, /logoGroup\.rotation\.y=\.20\+/);
  assert.match(js, /envMapIntensity:1\.70/);
  assert.match(js, /new THREE\.ShaderMaterial\(/);
  assert.match(js, /reflection=clamp\(broad\*\.23\+narrow\*\.31\+edge\*\.39/);
  assert.match(js, /const sheen=new THREE\.Mesh\(logoGeometry\.clone\(\),sheenMaterial\)/);
  assert.doesNotMatch(js, /TorusGeometry|random constellation|Math\.random\(/);
});

test("topology represents exactly eight modalities and six infrastructure services", () => {
  const js = read("scripts/home-topology.js");
  const ids = [...home.matchAll(/data-graph-node="([^"]+)"/g)].map(m=>m[1]);
  const expected = ["text","image","video","audio","3d","embedding","realtime","decision",
    "agents","deployments","buckets","shield","organizations","console"];
  assert.deepEqual(ids,expected);
  assert.equal(new Set(ids).size,14);
  assert.match(home, /aria-label="Explore model modalities"/);
  assert.match(home, /aria-label="Explore connected infrastructure services"/);
  for (const id of expected) assert.match(js,new RegExp(id==="3d" ? '"3d"' : "\\b"+id+"\\b"));
  assert.match(js, /const RELATIONS=\[/);
  assert.match(js, /\["deployments","buckets"\]/);
  assert.match(js, /\["agents","shield"\]/);
  assert.match(js, /\["organizations","console"\]/);
  assert.match(js, /inputHub/);
  assert.match(js, /outputHub/);
  assert.match(js, /new THREE\.CatmullRomCurve3\(/);
  assert.doesNotMatch(js,/new THREE\.TorusGeometry|28; i\+\+/);
});

test("each product control links to the correct existing section or modality", () => {
  const anchors=[...home.matchAll(/<a data-graph-node="([^"]+)" href="([^"]+)"/g)];
  const ids=new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const [,id,href] of anchors) {
    if(href.startsWith("#")) assert.ok(ids.has(href.slice(1)), "Broken section link: "+id);
    else assert.equal(href, "marketplace.html?modality="+id);
  }
  assert.match(home, /data-graph-inspector/);
  assert.match(home, /data-graph-title/);
  assert.match(home, /data-graph-description/);
  assert.match(home, /data-graph-link/);
  assert.match(read("scripts/home-topology.js"), /function setSelected\(id\)/);
});

test("Three.js is lazy, reduces motion, and cleans up resources", () => {
  const js=read("scripts/home-topology.js");
  for(const feature of [
    "IntersectionObserver", "ResizeObserver", "prefers-reduced-motion",
    "visibilitychange","document.visibilityState","webglcontextlost",
    "requestAnimationFrame","cancelAnimationFrame","renderer.dispose()",
    "matchMedia", "pagehide", "env.dispose()"
  ]) assert.ok(js.includes(feature),feature);
  assert.match(js,/import\(THREE_URL\)/);
  assert.match(js,/import\(THREE_FALLBACK_URL\)/);
  assert.match(js,/three@0\.171\.0\/build\/three\.module\.js/);
  assert.match(js,/const canRun=\(\)=>!disposed && !reduced\.matches/);
  assert.match(js,/Math\.min\(window\.devicePixelRatio\|\|1,narrow\?1\.3:1\.65\)/);
  assert.match(js,/mobile\.matches\?1000\/24:1000\/30/);
  assert.match(js,/scene\.traverse/);
  const {execFileSync}=require("node:child_process");
  assert.doesNotThrow(()=>execFileSync(process.execPath,
    ["--check",path.join(root,"scripts/home-topology.js")]));
});

test("responsive architecture keeps useful model and infrastructure controls visible", () => {
  assert.match(css,/\.ip-architecture-stage \{position:relative;height:490px;/);
  assert.match(css,/\.ip-architecture-layers \{[\s\S]*?grid-template-columns:/);
  assert.match(css,/\.ip-architecture-layer-links a:focus-visible/);
  assert.match(css,/@media \(max-width:700px\)/);
  assert.match(css,/\.ip-architecture-layer-links \{[\s\S]*?overflow-x:auto;/);
  assert.match(css,/\.ip-architecture-stage \{height:clamp\(380px,101vw,490px\);\}/);
  assert.match(css,/\.ip-architecture-webgl \{display:block;/);
  assert.match(css,/\.ip-architecture\.has-webgl \.ip-architecture-fallback \{opacity:0;\}/);
  assert.match(css,/:root\[data-theme="dark"\] \.ip-architecture/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/\.lp-topology/);
});

test("quickstart is a dedicated final section after the marketing narrative", () => {
  assert.match(home, /class="lp-closing lp-quickstart" id="quickstart"/);
  assert.match(home, /class="lp-code lp-quickstart-workbench"/);
  assert.match(home, /class="ip-architecture"/);
  assert.match(home, /<script type="module" src="scripts\/home-topology\.js"><\/script>/);
  assert.equal([...home.matchAll(/data-example-panel=/g)].length,8);
  assert.ok(home.indexOf('id="quickstart"') > home.indexOf('id="pricing"'));
});

test("active paths are meaningful and context loss restores accessible fallback", () => {
  const js = read("scripts/home-topology.js");
  assert.match(js, /setSelected\(mobile\.matches\?"text":"agents"\)/);
  assert.match(js, /const RELATIONS=\[/);
  assert.match(js, /const onContextLost=e=>\{e\.preventDefault\(\);destroy\(\);onFailure\?\.\(\);\};/);
  assert.match(js, /shell\.dataset\.fallback="context-lost"/);
  assert.match(js, /foil\.material\.opacity=themeDark\?\.07:\.055/);
});

test("mobile keeps only one capability layer visible at a time", () => {
  const js=read("scripts/home-topology.js");
  assert.match(home, /class="ip-architecture-layer-switch" role="tablist"/);
  assert.match(home, /data-graph-tab="models" aria-controls="ip-layer-models"/);
  assert.match(home, /data-graph-tab="services" aria-controls="ip-layer-services"/);
  assert.match(js, /function activateLayer\(which\)/);
  assert.match(js, /modelLayer\.hidden=mobile\.matches && chosen==="services"/);
  assert.match(js, /serviceLayer\.hidden=mobile\.matches && chosen==="models"/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /mobile\.addEventListener\?\.\("change",onViewportChange\)/);
  assert.match(css, /\.ip-architecture-layer\[hidden\] \{display:none!important;\}/);
});

test("graph rotation remains readable after extreme input and can reset", () => {
  const js=read("scripts/home-topology.js");
  assert.match(js,/const MAX_YAW=\.20,MAX_PITCH=\.105/);
  assert.match(js,/inputYaw=clamp\(drag\.baseYaw\+dx\*\.0042,MAX_YAW\)/);
  assert.match(js,/inputPitch=clamp\(drag\.basePitch\+dy\*\.0032,MAX_PITCH\)/);
  assert.match(js,/const yaw=clamp\(inputYaw\+pointerTilt\.x\*\.055\+Math\.sin\(time\*\.48\)\*\.025,MAX_YAW\)/);
  assert.match(js,/graph\.rotation\.set\(/);
  assert.match(js,/velocity\.multiplyScalar\(Math\.exp\(-delta\*12\)\)/);
  assert.match(js,/function resetView\(\)/);
  assert.match(js,/stage\.dataset\.graphYaw=graph\.rotation\.y\.toFixed\(3\)/);
  assert.match(home,/data-graph-reset/);
  assert.match(css,/\.ip-architecture:not\(\.has-webgl\) \.ip-architecture-reset \{display:none;\}/);
  assert.doesNotMatch(js,/targetRotation\.premultiply|graph\.quaternion\.slerp/);
  assert.match(js,/logoGroup\.scale\.setScalar\(narrow\?1\.52:1\.12\)/);
});

test("product actions are real prominent buttons and deploy links resolve to its console", () => {
  assert.equal([...home.matchAll(/class="lp-proof-link"/g)].length,10);
  assert.match(home,/class="lp-deploy-preview-footer"[\s\S]*?<a class="lp-preview-action" href="\/console\/deploy">Deploy model/);
  assert.match(home,/href="\/console\/deploy">Browse deployments/);
  assert.match(home,/href="\/console\/deploy"><span>DEPLOYMENTS<\/span>/);
  assert.doesNotMatch(home,/class="lp-deploy-preview-footer"[\s\S]*?<b>Deploy model/);
  assert.match(css,/\.lp-proof-link,[\s\S]*?min-height:47px;padding:12px 20px/);
  assert.match(css,/background:#ffd625;border:1px solid #ffd625/);
  assert.match(css,/\.lp-deploy-preview-footer \.lp-preview-action/);
  assert.match(css,/\.lp-proof-link:focus-visible/);
});

test("preview accent colors and workspace padding are intentionally differentiated", () => {
  for (const name of ["lp-deploy-preview-status","lp-bucket-preview-symbol","lp-shield-indicator",
    "lp-council-indicator","lp-lightning-workspace","lp-desktop-window"]) {
    assert.ok(home.includes(name),"Missing purposeful preview element "+name);
  }
  for (const selector of [".lp-deploy-preview {",".lp-bucket-visual {",".lp-proof-interface {",
    ".lp-council-visual {","#cli .lp-ecosystem-visual {","#lightning .lp-ecosystem-visual {",
    "#app .lp-ecosystem-visual {"]) {
    assert.ok(css.includes(selector),"Missing preview styling "+selector);
  }
  assert.match(css,/\.lp-workspace-layout > \.lp-workspace-console,[\s\S]*?padding:clamp\(32px,4vw,64px\)!important/);
  assert.match(css,/\.lp-workspace-layout > \.lp-workspace-org \{[\s\S]*?padding-left:clamp\(35px,4vw,65px\)!important/);
});

test("featured infrastructure and developer ecosystem have readable dedicated spotlights", () => {
  assert.equal([...home.matchAll(/class="lp-ecosystem-spotlight(?: lp-ecosystem-spotlight--reverse)?"/g)].length,4);
  for(const id of ["council","cli","lightning","app"]) {
    assert.match(home,new RegExp('<article class="lp-ecosystem-spotlight[^"]*" id="'+id+'"'));
  }
  assert.doesNotMatch(home,/class="lp-builder-grid"|class="lp-experience-links"/);
  assert.match(home,/class="lp-deploy-preview" aria-label="Illustrative deployment setup controls"/);
  assert.match(home,/class="lp-bucket-visual"/);
  assert.match(css,/\.lp-proof-pair \{display:flex;flex-direction:column;/);
  assert.match(css,/\.lp-ecosystem-spotlight \{[\s\S]*?grid-template-columns:/);
  assert.match(css,/\.lp-ecosystem-spotlight--reverse \.lp-ecosystem-copy/);
  assert.match(css,/@media \(max-width:900px\) \{[\s\S]*?\.lp-ecosystem-spotlight \{grid-template-columns:1fr;/);
});

test("unnecessary all-caps section kickers have been removed", () => {
  assert.doesNotMatch(home,/class="lp-kicker"|class="lp-detail-eyebrow"|class="lp-hero-overline"|class="lp-hero-demo-overline"/);
  assert.doesNotMatch(home,/ONE INTEGRATED PLATFORM|INFERENCEPORT \/ CONNECTED CAPABILITIES|SELECT A CAPABILITY TO EXPLORE/);
});


test("product spotlights restore main-site capability depth without a wall of cards", () => {
  const details = ["agents","deploy","buckets","shield","council","cli","lightning","app"];
  assert.doesNotMatch(home.slice(home.indexOf('class="lp-hero-grid"'),home.indexOf('class="lp-hero-bottom"')),/class="lp-feature-points"/);
  for(const id of details) {
    const at=home.indexOf('id="'+id+'"');
    assert.ok(at>0,"Missing product area "+id);
    assert.match(home.slice(at,at+3200),
      /class="lp-feature-points(?: lp-feature-points--inverse| lp-feature-points-shield)?"/,
      "Product section lacks useful capabilities: "+id);
  }
  assert.equal((home.match(/class="lp-feature-points/g)||[]).length,details.length);
  assert.match(home,/HTTP or SSE MCP servers/);
  assert.match(home,/organization’s workspace/);
  assert.match(home,/AWS CLI or compatible SDKs/);
  assert.match(home,/prompt injection/);
  assert.match(home,/Claude Code, Cursor, VS Code, Claude Desktop/);
  assert.match(home,/stdin support/);
  assert.match(home,/Lightning Image Turbo/);
  assert.match(home,/import GGUF files/);
  assert.match(home,/per-member and per-key limits/);
});

test("illustrative previews show actual developer workflows, not placeholder feature lists", () => {
  const {existsSync,statSync}=require("node:fs");
  const screenshot=path.join(root,"img/examples/cucumber.png");
  assert.ok(existsSync(screenshot) && statSync(screenshot).size>1000,
    "The original desktop screenshot asset must be present");
  assert.match(home,/class="lp-desktop-window"/);
  assert.match(home,/src="img\/examples\/cucumber.png"/);
  assert.match(home,/class="lp-lightning-message lp-lightning-message--assistant"/);
  assert.match(home,/class="lp-council-request"/);
  assert.match(home,/class="lp-bucket-files"/);
  assert.match(home,/class="lp-model-catalog"/);
  assert.match(home,/class="lp-shield-actions"/);
  assert.match(home,/class="lp-agent-journey"/);
  assert.match(css,/\.lp-desktop-window img \{display:block;width:100%;/);
  assert.match(css,/\.lp-lightning-message--user/);
  assert.match(css,/\.lp-feature-points li:before/);
  assert.doesNotMatch(home,/12\.4k Requests|\$18\.20 Spend/);
});

test("restored detail keeps working CTAs, API tabs and semantic structure", () => {
  assert.match(home,/href="\/console\/deploy">Browse deployments/);
  assert.match(home,/href="\/console\/deploy">Deploy model/);
  assert.match(home,/href="chat\/">Try Lightning chat/);
  assert.match(home,/href="install.html#install">Download the desktop app/);
  assert.match(home,/href="\/console\/agents">Configure an agent/);
  assert.equal((home.match(/data-example-tab=/g)||[]).length,8);
  assert.equal((home.match(/class="lp-ecosystem-spotlight(?: lp-ecosystem-spotlight--reverse)?"/g)||[]).length,4);
});


test("Shield retains original protection scope and shows a concrete example response", () => {
  const shield=home.slice(home.indexOf('<article class="lp-proof-shield"'),home.indexOf("</article>",home.indexOf('<article class="lp-proof-shield"')));
  for(const expected of ["Sign-up and trial abuse","Identity and account risk","Content moderation",
    "Prompt and agent protection","Actionable decisions","Disposable email indicators",
    "risk_score","confidence","decision","reasons","Rate limit","Illustrative only"]) {
    assert.ok(shield.includes(expected),"Missing Shield product explanation: "+expected);
  }
  assert.match(shield,/class="lp-shield-json"/);
  assert.match(shield,/class="lp-shield-demo-input"/);
  assert.match(css,/\.lp-shield-json \{/);
  assert.doesNotMatch(shield,/class="lp-shield-schema" aria-label="Shield analyze API response fields"/);
});

test("Lightning is clearly a browser chat product separate from the API", () => {
  const light=home.slice(home.indexOf('id="lightning"'),home.indexOf('</article>',home.indexOf('id="lightning"')));
  assert.match(light,/Lightning: chat and create in your browser/);
  assert.match(light,/not the hosted model API/);
  assert.match(light,/href="#api">Pay-to-Go model API/);
  assert.match(light,/href="chat\/">Try Lightning chat/);
  assert.match(light,/class="lp-lightning-workspace"/);
  assert.match(light,/class="lp-lightning-conversation"/);
  assert.doesNotMatch(light,/Hosted AI, ready when you are/);
});

test("technical demos present meaningful workflows without fake live claims or redundant gradient frames", () => {
  for(const term of ["lp-council-voices","lp-council-review-stages","lp-council-synthesis",
    "lp-cli-step-label","lp-cli-terminal-body","lp-shield-json",
    "lp-lightning-compose","Actual app screenshot"]) {
    assert.ok(home.includes(term),"Missing purposeful product preview: "+term);
  }
  assert.match(css,/#council \.lp-ecosystem-visual,/);
  assert.match(css,/\.lp-ecosystem-spotlight \{[\s\S]*?padding:clamp\(55px,6\.2vw,88px\) 0;/);
  assert.match(css,/\.lp-desktop-visual \.lp-desktop-window img \{[\s\S]*?max-height:none/);
});


test("bucket docs URLs, logo caption and light quickstart contrast stay correct", () => {
  const correct="https://docs.inferenceport.ai/en/latest/api/buckets.html";
  assert.equal(home.split('href="'+correct+'"').length-1,2,
    "Both bucket documentation references must point to the current docs path");
  assert.doesNotMatch(home,/docs\.inferenceport\.ai\/api\/buckets\.html/);
  assert.doesNotMatch(home,/ip-architecture-core-caption|THE UNIFIED PLATFORM/);
  assert.match(css,/:root:not\(\[data-theme="dark"\]\) \.lp-hero-demo-intro > \.lp-feature-points li \{[\s\S]*?color:#455365/);
  assert.match(css,/:root:not\(\[data-theme="dark"\]\) \.lp-hero-demo-intro > \.lp-feature-points strong \{[\s\S]*?color:#111a28/);
});

test("continuous atmospheric canvas is real scroll-linked weather, not cropped side stickers", () => {
  const weather=read("scripts/home-weather.js");
  assert.match(home,/<div class="lp-weather" id="lp-weather" aria-hidden="true" data-phase="cloud"><\/div>/);
  assert.match(home,/<script defer src="scripts\/home-weather\.js"><\/script>/);
  assert.match(weather,/window\.matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(weather,/window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(weather,/Boolean\(navigator\.connection && navigator\.connection\.saveData\)/);
  assert.match(weather,/window\.requestAnimationFrame\(frame\)/);
  assert.match(weather,/targetScroll=window\.scrollY/);
  assert.match(weather,/scroll=mix\(scroll,targetScroll,1-Math\.exp\(-delta\/165\)\)/);
  assert.match(weather,/const shift=scroll\*cloud\.depth\+clock\*/);
  assert.match(weather,/ctx\.createLinearGradient\(0,0,width,0\)/);
  assert.match(weather,/ctx\.globalCompositeOperation="destination-in"/);
  assert.match(weather,/function rainPass\(weight\)/);
  assert.match(weather,/function electricPass\(weight\)/);
  assert.match(weather,/function waterPass\(weight\)/);
  assert.match(weather,/if\(el\) sectionY\[id\]=window\.scrollY/);
  assert.match(weather,/host\.dataset\.weatherScroll=Math\.round\(scroll\)/);
  assert.match(weather,/window\.addEventListener\("scroll",onScroll,\{passive:true\}\)/);
  assert.match(weather,/canvas\.getContext\("2d",\{alpha:true\}\)/);
  assert.match(weather,/visible=!document\.hidden/);
  assert.match(css,/\.lp-weather-canvas \{[\s\S]*?width:100%/);
  assert.match(css,/@media \(max-width:1023px\),\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.lp-weather \{[\s\S]*?pointer-events:none/);
  assert.doesNotMatch(weather,/setInterval|setTimeout|fetch\(|WebGLRenderer|THREE|measureGutters|lp-weather-rail/);
  assert.doesNotMatch(css,/\.lp-weather-rail--left|\.lp-weather-rail--right/);
});

test("hero mark has neutral opalescent glass, not a blue metallic fill", () => {
  const js=read("scripts/home-topology.js");
  assert.match(js,/color:0xe4e1e7,roughness:\.052,metalness:0/);
  assert.match(js,/transmission:\.96,thickness:1\.05,ior:1\.48/);
  assert.match(js,/iridescence:\.47,iridescenceIOR:1\.34/);
  assert.match(js,/attenuationColor:new THREE\.Color\(0xe2dce7\)/);
  assert.match(js,/glass\.color\.setHex\(themeDark\?0xd9d5df:0xeae6ee\)/);
  assert.match(js,/foil\.material\.opacity=themeDark\?\.07:\.055/);
  assert.doesNotMatch(js,/color:0xc4d5e2|attenuationColor:new THREE\.Color\(0xb4c9dc\)/);
  assert.match(js,/const MARK_VERTICES = \[/);
  assert.match(js,/const MAX_YAW=\.20,MAX_PITCH=\.105/);
});

test("lightning mark uses translucent front glass and rounded reflective side glass", () => {
  const js=read("scripts/home-topology.js");
  assert.match(js,/bevelSize:\.115/);
  assert.match(js,/bevelThickness:\.145,bevelSegments:9/);
  assert.match(js,/const edgeGlass=new THREE\.MeshPhysicalMaterial\(/);
  assert.match(js,/const body=new THREE\.Mesh\(logoGeometry,\[glass,edgeGlass\]\)/);
  assert.match(js,/edgeGlass\.color\.setHex\(themeDark\?0xb4afbd:0xc8c2ce\)/);
});


test("atmosphere tuning keeps cloud motion calm while preserving readable weather", () => {
  const js=read("scripts/home-weather.js");
  assert.match(js,/depth:near\?\.13:\.05/);
  assert.match(js,/cloud\.depth\*\.0065\+\.002/);
  assert.match(js,/Math\.sin\(clock\*\.000085\+cloud\.sway\*6\)\*18/);
  assert.match(js,/Math\.sin\(clock\*\.00005\+cloud\.sway\)\*\.022/);
  assert.match(js,/for\(let i=0;i<78;i\+\+\)/);
  assert.match(js,/weight\*\(themeDark\?\.46:\.30\)/);
  assert.match(js,/const length=13\+rand\(i\*8\.33\+6\)\*35/);
  assert.match(js,/waterPass\(Math\.max\(buckets\*\.96,desktopAI\*\.52,\.06\)\)/);
  assert.match(js,/electricPass\(Math\.max\(shield\*\.39,lightning\*1\.04,\.07\)\)/);
  assert.match(js,/ctx\.globalAlpha=power\*\.66/);
  assert.match(js,/scroll=mix\(scroll,targetScroll,1-Math\.exp\(-delta\/165\)\)/);
  // Preserve the original accessibility, performance, and layout protections.
  assert.match(js,/const CANVAS_LIMIT=1\.5, FPS=30/);
  assert.match(js,/function softenCenter\(\)/);
  assert.match(js,/reduced\.matches\|\|saveData/);
  assert.match(js,/window\.addEventListener\("scroll",onScroll,\{passive:true\}\)/);
});


test("six recognizable marks are grouped as customers and startup-program memberships", () => {
  const section = home.match(/<section class="lp-trust lp-wrap" id="customers"[\s\S]*?<\/section>/);
  assert.ok(section, "The customer and program band should be visible in static HTML");
  const band=section[0];
  assert.ok(home.indexOf('id="customers"') > home.indexOf('class="lp-hero-grid"'));
  assert.ok(home.indexOf('id="customers"') > home.indexOf('id="pricing"'));
  assert.ok(home.indexOf('id="customers"') > home.indexOf('class="lp-hero-bottom"'));
  assert.match(band,/Used by teams/);
  assert.match(band,/Pollinations collaboration/);
  assert.match(band,/Startup programs/);
  assert.match(band,/Recognized startup memberships/);
  for (const [name,url,asset] of [
    ["Pollinations.ai","https://pollinations.ai/","pollinations.svg"],
    ["TomdacatAI","https://ai.tomdacat.com/","tomdacat.svg"],
    ["ReyGrid","https://reygrid.com/","reygrid.png"],
  ]) {
    assert.ok(band.includes(url), "Missing customer destination "+name);
    assert.ok(band.includes("/img/brands/"+asset), "Missing customer logo "+name);
    assert.ok(fs.existsSync(path.join(root,"img/brands",asset)), "Missing local asset "+asset);
  }
  for (const [name,url] of [
    ["E2B for Startups","https://e2b.dev/startups"],
    ["Microsoft for Startups","https://www.microsoft.com/en-us/startups"],
    ["OpenRouter for Startups","https://openrouter.ai/startup-program"]
  ]) {
    assert.ok(band.includes('aria-label="'+name+'"'),"Missing labeled startup link "+name);
    assert.ok(band.includes(url),"Missing startup program link "+name);
  }
  assert.match(band,/\/partnerships\/pollinations\.html/);
  assert.match(band,/\/img\/brands\/e2b-for-startups\.png/);
  assert.match(band,/Partner-badges_1\.png/);
  assert.match(band,/\/img\/brands\/openrouter\.svg/);
  const badge=fs.readFileSync(path.join(root,"img/brands/e2b-for-startups.png"));
  assert.equal(badge.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.match(css,/\.lp-trust-mark:focus-visible/);
  assert.match(css,/@media \(max-width:560px\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(band,/lp-trust-story|lp-trust-index|lp-trust-tile/);
  const footer=read("components/ip-footer.js");
  for (const url of ["https://e2b.dev/startups","https://www.microsoft.com/en-us/startups","https://openrouter.ai/startup-program"]) {
    assert.ok(footer.includes(url),"Missing footer startup link "+url);
  }
  assert.match(footer,/href="\/index\.html#customers"/);
  assert.match(footer,/src="\/img\/brands\/e2b-for-startups\.png"/);
  assert.match(footer,/src="\/img\/brands\/openrouter\.svg"/);
  assert.match(read("styles/shared.css"),/\.ipf-startup-list > a:focus-visible/);
});
