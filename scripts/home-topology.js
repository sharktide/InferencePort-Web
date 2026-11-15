/**
 * InferencePort platform topology — lightweight, genuinely 3D product map.
 * Geometry, routes, and links are intentional product relationships.
 *
 * Three.js is loaded only while the scene is near the viewport, from a pinned
 * version. The HTML/SVG directory remains usable if WebGL/CDN access fails.
 * There is no user activity simulation or telemetry in this visualization.
 */
const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js";
const THREE_BACKUP_URL = "https://unpkg.com/three@0.171.0/build/three.module.js";
const NODE_DESCRIPTIONS = Object.freeze({
  models: "One model catalog for text, image, video, audio, 3D, realtime and decisions.",
  agents: "Create reusable agents with instructions, MCP tools and clear billing controls.",
  deployments: "Deploy supported open models and call them through InferencePort.",
  buckets: "Store weights, datasets and model outputs using scoped S3-compatible access.",
  shield: "Add risk analysis, content checks and structured security decisions.",
  organizations: "Shared wallets, roles, limits, and service-aware team usage.",
  console: "Explore models, issue keys and manage the infrastructure in one place.",
  video: "Find video generation models for creative pipelines.",
  audio: "Use speech generation, transcription, and audio models.",
  "3d": "Turn images and prompts into three-dimensional assets.",
  realtime: "Build streaming voice conversations and low-latency audio experiences."
});

const NODES = Object.freeze([
  { id: "models",        label: "Models",        href: "#api",                              x: -3.10, y:  1.45, z:  0.20, group: "gold",  primary: true },
  { id: "agents",        label: "Agents",        href: "#agents",                           x:  2.85, y:  1.65, z:  0.40, group: "gold",  primary: true },
  { id: "deployments",   label: "Deployments",   href: "#deploy",                           x:  3.45, y: -0.25, z: -0.40, group: "blue",  primary: true },
  { id: "buckets",       label: "Buckets",       href: "#buckets",                          x:  2.15, y: -2.05, z:  0.42, group: "blue",  primary: true },
  { id: "shield",        label: "Shield",        href: "#shield",                           x: -2.10, y: -2.08, z:  0.32, group: "violet",primary: true },
  { id: "organizations", label: "Organizations", href: "#organizations",                    x: -3.40, y: -0.38, z: -0.25, group: "violet",primary: true },
  { id: "console",       label: "Console",       href: "#console",                          x:  0.05, y:  2.62, z: -0.46, group: "violet",primary: true },
  { id: "video",         label: "Video",         href: "marketplace.html?modality=video",    x: -1.75, y:  2.48, z: -0.70, group: "blue",  primary: false },
  { id: "audio",         label: "Audio",         href: "marketplace.html?modality=audio",    x:  3.42, y:  2.78, z: -1.00, group: "blue",  primary: false },
  { id: "3d",            label: "3D",            href: "marketplace.html?modality=3d",       x:  3.50, y: -2.54, z: -1.05, group: "gold",  primary: false },
  { id: "realtime",      label: "Realtime",      href: "marketplace.html?modality=realtime", x: -3.45, y: -2.67, z: -0.75, group: "gold",  primary: false }
]);

function init() {
  const shell = document.querySelector("#lp-topology");
  if (!shell) return;

  const stage = shell.querySelector(".lp-topology-stage");
  const canvasHost = shell.querySelector(".lp-topology-webgl");
  const labelLinks = new Map([...shell.querySelectorAll("[data-node]")].map(el => [el.dataset.node, el]));
  const satelliteLinks = new Map([...shell.querySelectorAll("[data-satellite]")].map(el => [el.dataset.satellite, el]));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 700px)");
  let instance = null;
  let loading = false;
  let disposed = false;
  let visible = false;

  // Mobile is a first-class interactive experience; only reduced-motion or unavailable WebGL uses static fallback.
  const canAnimate = () => !disposed && !reduced.matches;

  function applyMode() {
    if (!canAnimate()) {
      instance?.destroy();
      instance = null;
      shell.classList.remove("is-3d");
      shell.classList.add("is-static");
      return;
    }
    if (visible && !loading && !instance) void load();
  }

  async function load() {
    if (!canAnimate() || loading || instance) return;
    loading = true;
    try {
      let THREE;
      try { THREE = await import(THREE_MODULE_URL); }
      catch { THREE = await import(THREE_BACKUP_URL); }
      if (!canAnimate() || !visible) return;
      instance = buildScene({ THREE, shell, stage, canvasHost, labelLinks, satelliteLinks, compact });
      shell.classList.remove("is-static");
      shell.classList.add("is-3d");
      instance.start();
    } catch (error) {
      // The functional HTML/SVG topology remains intact on blocked CDN/WebGL.
      shell.classList.remove("is-3d");
      shell.classList.add("is-static");
      shell.dataset.fallback = "webgl-unavailable";
      if (window.location.hostname === "localhost") {
        console.warn("Interactive topology unavailable, using SVG fallback", error);
      }
    } finally {
      loading = false;
    }
  }

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        visible = entries.some(e => e.isIntersecting);
        if (visible) applyMode();
        else instance?.pause();
        if (visible) instance?.start();
      }, { rootMargin: "160px 0px", threshold: 0 })
    : null;

  if (observer) observer.observe(shell);
  else { visible = true; applyMode(); }

  reduced.addEventListener?.("change", applyMode);
  compact.addEventListener?.("change", applyMode);

  window.addEventListener("pagehide", () => {
    disposed = true;
    observer?.disconnect();
    instance?.destroy();
    instance = null;
    reduced.removeEventListener?.("change", applyMode);
    compact.removeEventListener?.("change", applyMode);
  }, { once: true });
}

function buildScene({ THREE, shell, stage, canvasHost, labelLinks, satelliteLinks, compact }) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: true, powerPreference: "low-power",
    preserveDrawingBuffer: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact.matches ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.className = "lp-topology-canvas";
  canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 70);
  camera.position.set(0, 0, 12.7);

  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  const key = new THREE.PointLight(0xffdf8c, 18, 18, 1.4);
  key.position.set(-3, 4, 6);
  const fill = new THREE.PointLight(0x8caaff, 12, 20, 1.5);
  fill.position.set(4, -2, 3);
  scene.add(ambient, key, fill);

  const graph = new THREE.Group();
  scene.add(graph);

  const geometry = new THREE.IcosahedronGeometry(0.17, 1);
  const satelliteGeometry = new THREE.IcosahedronGeometry(0.095, 1);
  const pickGeometry = new THREE.SphereGeometry(0.43, 12, 9);
  const pickMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
  });
  const pickTargets = [];
  const meshes = new Map();
  const wires = [];
  const tracers = [];
  const anchorWorld = new THREE.Vector3();
  const normalizedPointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const v = new THREE.Vector3();
  const coreGroup = new THREE.Group();
  graph.add(coreGroup);

  // The centerpiece is an extruded version of the InferencePort lightning mark,
  // not an interchangeable wireframe cube or a random decorative orb.
  const bolt = new THREE.Shape();
  bolt.moveTo(0.22, 1.28);
  bolt.lineTo(-0.48, 0.09);
  bolt.lineTo(-0.04, 0.09);
  bolt.lineTo(-0.29, -1.25);
  bolt.lineTo(0.60, 0.12);
  bolt.lineTo(0.13, 0.12);
  bolt.closePath();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe0b842, metalness: 0.58, roughness: 0.19,
    clearcoat: 0.95, clearcoatRoughness: 0.12,
    emissive: 0xa87309, emissiveIntensity: 0.11, side: THREE.DoubleSide
  });
  const boltGeometry = new THREE.ExtrudeGeometry(bolt, {
    depth: 0.27, steps: 1, bevelEnabled: true,
    bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 4,
    curveSegments: 8
  });
  boltGeometry.center();
  const coreBody = new THREE.Mesh(boltGeometry, bodyMaterial);
  coreGroup.add(coreBody);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xf1d172, transparent: true, opacity: 0.62 });
  const coreOutline = new THREE.LineSegments(new THREE.EdgesGeometry(boltGeometry, 30), edgeMaterial);
  coreGroup.add(coreOutline);
  // Secondary dark hub gives the object scale and depth without overpowering the logo.
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1c2636, metalness: 0.28, roughness: 0.38,
      transparent: true, opacity: 0.23, depthWrite: false, side: THREE.BackSide
    }));
  coreGroup.add(hub);
  coreGroup.scale.setScalar(compact.matches ? 1.5 : 1.26);

  const ringMaterials = [];
  for (const [radius, rotX, rotY, opacity] of [
    [1.18, 0.7, 0.12, 0.65], [1.41, 1.22, 0.36, 0.36], [1.66, 0.27, 1.02, 0.27]
  ]) {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6b866, transparent: true, opacity, depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 5, 144), ringMaterial);
    ring.rotation.set(rotX, rotY, 0);
    ringMaterials.push(ringMaterial);
    coreGroup.add(ring);
  }

  const palettes = {
    light: { gold: 0xbe8e12, blue: 0x506ed5, violet: 0x8564c4, core: 0x927224, wire: 0x6c7588 },
    dark:  { gold: 0xffd852, blue: 0x8fabff, violet: 0xc7a8ff, core: 0xf0c54b, wire: 0xb0b9ca }
  };
  let palette = palettes.light;

  for (const [index, n] of NODES.entries()) {
    const pos = new THREE.Vector3(n.x, n.y, n.z);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.27, metalness: 0.26,
      emissive: 0xffffff, emissiveIntensity: 0.15
    });
    const mesh = new THREE.Mesh(n.primary ? geometry : satelliteGeometry, material);
    mesh.position.copy(pos);
    graph.add(mesh);

    // Each major infrastructure node has a miniature orbit/constellation.
    // The markers stand for its connected capabilities, not fictional activity.
    const cluster = new THREE.Group();
    cluster.position.copy(pos);
    graph.add(cluster);
    const beadCount = n.primary ? (compact.matches ? 4 : 6) : 3;
    const clusterRadius = n.primary ? 0.39 : 0.23;
    for (let beadIndex = 0; beadIndex < beadCount; beadIndex++) {
      const angle = Math.PI * 2 * beadIndex / beadCount + index * 0.23;
      const distance = clusterRadius * (beadIndex % 3 === 0 ? 1.18 : 1);
      const bead = new THREE.Mesh(
        new THREE.IcosahedronGeometry(n.primary ? 0.037 : 0.024, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
          opacity: n.primary ? 0.7 : 0.42 })
      );
      bead.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance,
        ((beadIndex % 3) - 1) * 0.13);
      cluster.add(bead);
    }
    if (n.primary) {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.006, 4, 60),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
          opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
      );
      orbit.rotation.x = index % 2 ? 0.45 : -0.45;
      cluster.add(orbit);
    }

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: n.primary ? 0.55 : 0.32,
      depthWrite: false, side: THREE.DoubleSide
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(
      n.primary ? 0.21 : 0.12, n.primary ? 0.225 : 0.13, 48
    ), haloMaterial);
    halo.position.copy(pos);
    graph.add(halo);

    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.position.copy(pos);
    pick.userData.id = n.id;
    graph.add(pick);
    pickTargets.push(pick);

    const mid = pos.clone().multiplyScalar(0.48);
    mid.z += 0.7;
    const path = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, pos);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xb4b5c2, transparent: true, opacity: n.primary ? 0.36 : 0.18,
      depthWrite: false
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(48)), lineMaterial);
    graph.add(line);
    wires.push({ id: n.id, material: lineMaterial, primary: n.primary });

    const tracer = new THREE.Mesh(
      new THREE.SphereGeometry(n.primary ? 0.038 : 0.022, 9, 7),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: n.primary ? 0.82 : 0.45 })
    );
    graph.add(tracer);
    tracers.push({ mesh: tracer, path, phase: (index * 0.137) % 1, speed: 0.034 + index * 0.002 });

    meshes.set(n.id, { n, mesh, halo, cluster, material, haloMaterial, line, pos });
  }

  // Deliberate, low-density orbital markers — not a simulated traffic cloud.
  const markers = new THREE.Group();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x98a1b2, transparent: true, opacity: 0.46 });
  const markerGeometry = new THREE.SphereGeometry(0.026, 7, 5);
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const radius = 2.03 + (i % 5) * 0.14;
    const dot = new THREE.Mesh(markerGeometry, markerMaterial);
    dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.71, -1.45);
    markers.add(dot);
  }
  graph.add(markers);

  const inspector = shell.querySelector("[data-topology-inspector]");
  const inspectorTitle = inspector?.querySelector("[data-topology-title]");
  const inspectorDescription = inspector?.querySelector("[data-topology-description]");
  const inspectorExplore = inspector?.querySelector("[data-topology-explore]");
  let hovered = null;
  let selected = null;
  let pointerDown = null;
  let ignoreClick = false;
  let frame = 0;
  let inView = false;
  let killed = false;
  let lastFrame = 0;
  let clock = 0;
  let targetX = 0, targetY = 0;
  let ro = null;

  function applyColors() {
    palette = document.documentElement.getAttribute("data-theme") === "dark"
      ? palettes.dark : palettes.light;
    bodyMaterial.color.setHex(palette.core);
    bodyMaterial.emissive.setHex(palette.core);
    edgeMaterial.color.setHex(palette.core);
    ringMaterials.forEach(m => m.color.setHex(palette.core));
    markerMaterial.color.setHex(palette.wire);
    for (const { n, material, haloMaterial, cluster } of meshes.values()) {
      material.color.setHex(palette[n.group]);
      material.emissive.setHex(palette[n.group]);
      haloMaterial.color.setHex(palette[n.group]);
      cluster.children.forEach(child => child.material?.color?.setHex(palette[n.group]));
    }
    for (const wire of wires) wire.material.color.setHex(palette.wire);
    for (const { mesh } of tracers) mesh.material.color.setHex(palette.core);
  }

  function updateInspector(id) {
    const selectedNode = NODES.find(node => node.id === id);
    if (!inspector || !inspectorTitle || !inspectorDescription || !inspectorExplore) return;
    inspector.classList.toggle("is-selected", Boolean(selectedNode));
    inspectorTitle.textContent = selectedNode?.label || "InferencePort";
    inspectorDescription.textContent = selectedNode
      ? NODE_DESCRIPTIONS[selectedNode.id]
      : "Explore how models, deployments, storage and security connect.";
    inspectorExplore.href = selectedNode?.href || "#products";
    inspectorExplore.firstChild.textContent = selectedNode ? "Explore " + selectedNode.label + " " : "Explore platform ";
  }

  function setHovered(id) {
    if (hovered === id) return;
    hovered = id;
    updateInspector(id);
    shell.dataset.activeNode = id || "";
    for (const [key, info] of meshes) {
      const isSelected = id === key;
      const faded = Boolean(id) && !isSelected;
      info.mesh.scale.setScalar(isSelected ? 1.42 : 1);
      info.halo.scale.setScalar(isSelected ? 1.36 : 1);
      info.cluster.scale.setScalar(isSelected ? 1.22 : 1);
      info.haloMaterial.opacity = isSelected ? 1 : faded ? 0.18 : info.n.primary ? 0.55 : 0.32;
      info.material.emissiveIntensity = isSelected ? 0.55 : 0.15;
      info.line.material.opacity = isSelected ? 0.93 : faded ? 0.11 : info.n.primary ? 0.36 : 0.18;
    }
    for (const [key, link] of [...labelLinks, ...satelliteLinks]) {
      link.classList.toggle("is-active", key === id);
    }
  }

  function resize() {
    const width = Math.max(240, stage.clientWidth);
    const height = Math.max(240, stage.clientHeight);
    camera.aspect = width / height;
    camera.position.z = compact.matches ? 10.8 : 11.6;
    coreGroup.scale.setScalar(compact.matches ? 1.5 : 1.26);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact.matches ? 1.25 : 1.75));
    renderer.setSize(width, height, false);
    updateLabels();
  }

  function updateLabels() {
    if (compact.matches) {
      // On mobile labels form a horizontal link rail; they must not chase 3D points.
      for (const link of labelLinks.values()) {
        link.style.removeProperty("left");
        link.style.removeProperty("top");
      }
      return;
    }
    graph.updateWorldMatrix(true, true);
    for (const [id, link] of labelLinks) {
      const info = meshes.get(id);
      if (!info) continue;
      anchorWorld.copy(info.pos);
      graph.localToWorld(anchorWorld);
      v.copy(anchorWorld).project(camera);
      // Keep labels in the stage, even during a modest orbit/parallax.
      const px = Math.min(Math.max((v.x * 0.5 + 0.5) * stage.clientWidth, 69), stage.clientWidth - 69);
      const py = Math.min(Math.max((-v.y * 0.5 + 0.5) * stage.clientHeight, 50), stage.clientHeight - 50);
      link.style.left = px + "px";
      link.style.top = py + "px";
    }
  }

  function findHit(event) {
    const box = renderer.domElement.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    normalizedPointer.set(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -((event.clientY - box.top) / box.height) * 2 + 1
    );
    raycaster.setFromCamera(normalizedPointer, camera);
    const hit = raycaster.intersectObjects(pickTargets, false)[0];
    return hit?.object.userData.id || null;
  }

  function onPointerDown(event) {
    if (event.pointerType !== "touch" || event.target.closest?.("a")) return;
    pointerDown = { x: event.clientX, y: event.clientY, lastX: event.clientX };
    ignoreClick = false;
  }

  function onPointerUp() {
    pointerDown = null;
  }

  function onMove(event) {
    if (event.pointerType === "touch") {
      if (pointerDown) {
        const dx = event.clientX - pointerDown.x;
        const dy = event.clientY - pointerDown.y;
        if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy)) {
          ignoreClick = true;
          targetY = Math.max(-0.8, Math.min(0.8,
            targetY + (event.clientX - pointerDown.lastX) * 0.008));
          pointerDown.lastX = event.clientX;
        }
      }
      return;
    }
    const rect = stage.getBoundingClientRect();
    targetX = ((event.clientY - rect.top) / rect.height - 0.5) * 0.14;
    targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.18;
    const link = event.target.closest?.("[data-node]");
    const id = link?.dataset.node || findHit(event);
    setHovered(id);
    renderer.domElement.style.cursor = id ? "pointer" : "default";
  }

  function onClick(event) {
    // HTML links always navigate normally, including keyboard activation.
    if (event.target.closest?.("a") || ignoreClick) {
      ignoreClick = false;
      return;
    }
    const id = findHit(event);
    const href = NODES.find(node => node.id === id)?.href;
    if (!href) return;
    // A phone tap first reveals what a node does; the detail link navigates.
    if (compact.matches && selected !== id) {
      selected = id;
      setHovered(id);
      return;
    }
    window.location.assign(href);
  }

  function onLeave(event) {
    if (event.pointerType === "touch") return;
    targetX = 0;
    targetY = 0;
    setHovered(selected);
    renderer.domElement.style.cursor = "default";
  }

  function onLabelOver(event) {
    const id = event.currentTarget.dataset.node || event.currentTarget.dataset.satellite;
    setHovered(id);
  }

  for (const link of [...labelLinks.values(), ...satelliteLinks.values()]) {
    link.addEventListener("focus", onLabelOver);
    link.addEventListener("pointerenter", onLabelOver);
  }
  const onFocusOut = () => setHovered(selected);
  for (const link of [...labelLinks.values(), ...satelliteLinks.values()]) {
    link.addEventListener("blur", onFocusOut);
    link.addEventListener("pointerleave", onFocusOut);
  }

  stage.addEventListener("pointerdown", onPointerDown, { passive: true });
  stage.addEventListener("pointerup", onPointerUp, { passive: true });
  stage.addEventListener("pointercancel", onPointerUp, { passive: true });
  stage.addEventListener("pointermove", onMove, { passive: true });
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("click", onClick);
  document.addEventListener("ip-theme-change", applyColors);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") pause();
    else {
      const box = stage.getBoundingClientRect();
      if (box.bottom >= 0 && box.top <= window.innerHeight) start();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLost = e => { e.preventDefault(); destroy(); shell.classList.remove("is-3d"); };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);

  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(resize);
    ro.observe(stage);
  } else {
    window.addEventListener("resize", resize);
  }
  applyColors();
  resize();

  function tick(now) {
    if (killed || !inView) { frame = 0; return; }
    frame = requestAnimationFrame(tick);
    // Cap work at about 30fps on high-refresh displays and low-power devices.
    if (now - lastFrame < (compact.matches ? 45 : 32)) return;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.08) : 0;
    lastFrame = now;
    clock += delta;

    const idleX = Math.sin(clock * 0.31) * 0.06;
    const idleY = Math.cos(clock * 0.22) * 0.13;
    graph.rotation.x += (targetX + idleX - graph.rotation.x) * 0.038;
    graph.rotation.y += (targetY + idleY - graph.rotation.y) * 0.038;
    coreGroup.rotation.y = Math.sin(clock * 0.43) * 0.25;
    coreGroup.rotation.z = Math.sin(clock * 0.18) * 0.05;
    let clusterIndex = 0;
    for (const { cluster } of meshes.values()) {
      cluster.rotation.z = Math.sin(clock * 0.22 + clusterIndex++ * 0.6) * 0.1;
    }
    for (const { mesh, path, phase, speed } of tracers) {
      mesh.position.copy(path.getPoint((phase + clock * speed) % 1));
    }
    renderer.render(scene, camera);
    updateLabels();
  }

  function start() {
    if (killed || inView || document.visibilityState === "hidden") return;
    inView = true;
    lastFrame = 0;
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    inView = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }
  function destroy() {
    if (killed) return;
    killed = true;
    pause();
    ro?.disconnect();
    if (!ro) window.removeEventListener("resize", resize);
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerleave", onLeave);
    stage.removeEventListener("click", onClick);
    document.removeEventListener("ip-theme-change", applyColors);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const link of [...labelLinks.values(), ...satelliteLinks.values()]) {
      link.removeEventListener("focus", onLabelOver);
      link.removeEventListener("pointerenter", onLabelOver);
      link.removeEventListener("blur", onFocusOut);
      link.removeEventListener("pointerleave", onFocusOut);
    }
    renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
    scene.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose?.();
    });
    renderer.dispose();
    renderer.domElement.remove();
    shell.classList.remove("is-3d");
    labelLinks.forEach(link => { link.style.removeProperty("left"); link.style.removeProperty("top"); link.classList.remove("is-active"); });
    satelliteLinks.forEach(link => link.classList.remove("is-active"));
    updateInspector(null);
  }
  return { start, pause, destroy };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
