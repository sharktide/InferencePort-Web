/**
 * InferencePort infrastructure architecture, not a decorative solar-system demo.
 *
 * The glass core uses the EXACT silhouette used by components/ip-navbar.js:
 * M320 45h145L352 233h121L183 580l105-252H183z
 *
 * Eight actual API modalities feed one control plane. Six actual infrastructure
 * services branch out. A selected path is highlighted; there is no fake usage
 * traffic, arbitrary particle field, or simulated customer activity.
 *
 * Three.js loads only when the scene is near the viewport; the SVG and HTML
 * links are immediately available without WebGL, motion or JavaScript.
 */
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js";
const THREE_FALLBACK_URL = "https://unpkg.com/three@0.171.0/build/three.module.js";
const MARK_PATH = "M320 45h145L352 233h121L183 580l105-252H183z";
const MARK_VERTICES = [
  [320, 45], [465, 45], [352, 233], [473, 233],
  [183, 580], [288, 328], [183, 328]
];
const MODALITY_NAMES = ["text", "image", "video", "audio", "3d", "embedding", "realtime", "decision"];
const SERVICE_NAMES = ["agents", "deployments", "buckets", "shield", "organizations", "console"];
const CAPABILITIES = Object.freeze({
  text: {title:"Text",description:"Reason, write code, and build language workflows through the unified API."},
  image:{title:"Image",description:"Generate or edit visual assets using models in the image catalog."},
  video:{title:"Video",description:"Generate video clips using dedicated text-to-video models."},
  audio:{title:"Audio",description:"Synthesize speech, transcribe recordings, and generate audio."},
  "3d":{title:"3D",description:"Reconstruct and generate 3D assets from supported models."},
  embedding:{title:"Embeddings",description:"Create vectors for retrieval, ranking, and semantic search."},
  realtime:{title:"Realtime",description:"Build low-latency, streaming voice conversations and transcription."},
  decision:{title:"Decisions",description:"Get structured classification and scoring outputs."},
  agents:{title:"Managed agents",description:"Add a model, instructions, and MCP tools; invoke your agent like a model."},
  deployments:{title:"Model deployments",description:"Deploy open models and route inference through the same platform."},
  buckets:{title:"Buckets",description:"S3-compatible storage for model weights, datasets, and outputs."},
  shield:{title:"AI Shield",description:"Screen risky requests and get structured abuse and content signals."},
  organizations:{title:"Organizations",description:"Share access, budgets, policies, and reporting across a team."},
  console:{title:"Developer console",description:"Test models, issue API keys, monitor usage, and manage services."}
});

function initTopology() {
  const shell=document.querySelector("#lp-topology");
  if(!shell) return;
  const stage=shell.querySelector(".ip-architecture-stage");
  const host=shell.querySelector(".ip-architecture-canvas");
  const anchors=[...shell.querySelectorAll("[data-graph-node]")];
  const title=shell.querySelector("[data-graph-title]");
  const description=shell.querySelector("[data-graph-description]");
  const explore=shell.querySelector("[data-graph-link]");
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile=window.matchMedia("(max-width: 700px)");
  let active=null;
  let instance=null,visible=false,disposed=false,loading=false;

  function setSelected(id) {
    const chosen=CAPABILITIES[id] ? id : null;
    active=chosen;
    shell.dataset.selected=chosen || "";
    for(const a of anchors) {
      a.classList.toggle("is-selected",a.dataset.graphNode===chosen);
      if(a.dataset.graphNode===chosen) a.setAttribute("aria-current","true");
      else a.removeAttribute("aria-current");
    }
    const entry=CAPABILITIES[chosen];
    title.textContent=entry?.title || "One platform. Connected workflows.";
    description.textContent=entry?.description || "Choose a model type or infrastructure service to trace how it fits into the platform.";
    const target=anchors.find(a=>a.dataset.graphNode===chosen);
    explore.href=target?.getAttribute("href") || "#products";
    explore.firstChild.textContent=entry ? "Explore "+entry.title+" " : "Explore platform ";
    instance?.setSelected(chosen);
  }
  for(const a of anchors) {
    const id=a.dataset.graphNode;
    a.addEventListener("pointerenter",e=>{
      if(e.pointerType!=="touch" && !mobile.matches) setSelected(id);
    });
    a.addEventListener("focus",()=>setSelected(id));
    a.addEventListener("click",e=>{
      if(mobile.matches && active!==id && !reduced.matches) {
        e.preventDefault(); setSelected(id);
      }
    });
  }

  setSelected("agents");

  const canRun=()=>!disposed && !reduced.matches;
  async function ensureScene() {
    if(loading||instance||!canRun()||!visible) return;
    loading=true;
    try {
      let THREE;
      try {THREE=await import(THREE_URL);}
      catch {THREE=await import(THREE_FALLBACK_URL);}
      if(!canRun()||!visible) return;
      instance=makeScene({THREE,stage,host,mobile,onPick:setSelected,
        onFailure:()=>{shell.classList.remove("has-webgl");shell.classList.add("is-fallback");shell.dataset.fallback="context-lost";instance=null;}});
      shell.classList.add("has-webgl");
      shell.classList.remove("is-fallback");
      instance.setSelected(active);
      instance.start();
    } catch(error) {
      shell.classList.remove("has-webgl");
      shell.classList.add("is-fallback");
      shell.dataset.fallback="webgl-unavailable";
      if(window.location.hostname==="localhost") console.warn("Using static architecture map:",error);
    } finally {
      loading=false;
    }
  }
  function updateMode() {
    if(!canRun()) {
      instance?.destroy();instance=null;
      shell.classList.remove("has-webgl");
      shell.classList.add("is-fallback");
      return;
    }
    if(visible) void ensureScene();
  }
  const io="IntersectionObserver" in window
    ? new IntersectionObserver(entries=>{
        visible=entries.some(e=>e.isIntersecting);
        if(visible) {if(instance)instance.start();else void ensureScene();}
        else instance?.pause();
      },{rootMargin:"160px 0px"})
    : null;
  if(io)io.observe(shell);
  else {visible=true;void ensureScene();}
  reduced.addEventListener?.("change",updateMode);
  const onTheme=()=>instance?.updateTheme();
  document.addEventListener("ip-theme-change",onTheme);
  // The site theme manager also mutates data-theme directly.
  const themeObserver=new MutationObserver(onTheme);
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  window.addEventListener("pagehide",()=>{
    disposed=true;io?.disconnect();themeObserver.disconnect();
    reduced.removeEventListener?.("change",updateMode);
    document.removeEventListener("ip-theme-change",onTheme);
    instance?.destroy();instance=null;
  },{once:true});
}

function makeScene({THREE,stage,host,mobile,onPick,onFailure}) {
  const renderer=new THREE.WebGLRenderer({
    antialias:true,alpha:true,powerPreference:"low-power",preserveDrawingBuffer:false
  });
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;
  renderer.domElement.className="ip-architecture-webgl";
  renderer.domElement.setAttribute("aria-hidden","true");
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,80);
  const graph=new THREE.Group();
  scene.add(graph);

  // Procedural studio environment: bright strip lights reflected/refracted by glass.
  // It contains no network images, brand logos, or arbitrary environmental assets.
  const pano=document.createElement("canvas");
  pano.width=1024;pano.height=512;
  const ctx=pano.getContext("2d");
  const background=ctx.createLinearGradient(0,0,1024,512);
  background.addColorStop(0,"#263b55");background.addColorStop(.25,"#8497b5");
  background.addColorStop(.47,"#ecf0f3");background.addColorStop(.73,"#344765");
  background.addColorStop(1,"#c7b27e");
  ctx.fillStyle=background;ctx.fillRect(0,0,1024,512);
  for(const [x,w,alpha] of [[100,95,.9],[350,18,.85],[680,82,.78],[900,24,.8]]) {
    const light=ctx.createLinearGradient(x,0,x+w,0);
    light.addColorStop(0,"rgba(255,255,255,0)");
    light.addColorStop(.3,"rgba(255,255,255,"+alpha+")");
    light.addColorStop(.7,"rgba(255,255,255,"+alpha+")");
    light.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=light;ctx.fillRect(x,50,w,415);
  }
  const env=new THREE.CanvasTexture(pano);
  env.mapping=THREE.EquirectangularReflectionMapping;
  env.colorSpace=THREE.SRGBColorSpace;
  scene.environment=env;

  scene.add(new THREE.AmbientLight(0xffffff,.62));
  const warm=new THREE.DirectionalLight(0xffe1a3,1.95);
  warm.position.set(-4,5,8);scene.add(warm);
  const cool=new THREE.DirectionalLight(0xa2c4ff,1.5);
  cool.position.set(4,-2,5);scene.add(cool);
  const rim=new THREE.DirectionalLight(0xffffff,1.35);
  rim.position.set(2,3,-3);scene.add(rim);

  // EXACT canonical brand mark from ip-navbar.js; SVG coordinates are inverted
  // into Three.js coordinates. This outline must never be hand approximated.
  const logoShape=new THREE.Shape();
  MARK_VERTICES.forEach(([x,y],i)=>{
    const px=(x-328)*.0068,py=(312.5-y)*.0068;
    if(i===0)logoShape.moveTo(px,py);
    else logoShape.lineTo(px,py);
  });
  logoShape.closePath();
  const logoGeometry=new THREE.ExtrudeGeometry(logoShape,{
    depth:.43,steps:1,bevelEnabled:true,bevelSize:.075,
    bevelThickness:.115,bevelSegments:6,curveSegments:8
  });
  logoGeometry.center();
  const glass=new THREE.MeshPhysicalMaterial({
    color:0xc4d5e2,roughness:.035,metalness:0,
    transmission:.96,thickness:2.35,ior:1.49,
    clearcoat:1,clearcoatRoughness:.04,
    iridescence:.12,iridescenceIOR:1.35,
    envMapIntensity:1.48,attenuationColor:new THREE.Color(0xb4c9dc),
    attenuationDistance:4.2,side:THREE.DoubleSide
  });
  const logoGroup=new THREE.Group();
  logoGroup.position.set(0,0,.73);
  graph.add(logoGroup);
  const body=new THREE.Mesh(logoGeometry,glass);
  logoGroup.add(body);
  const foil=new THREE.Mesh(logoGeometry.clone(),new THREE.MeshStandardMaterial({
    color:0xb0c4d7,metalness:.14,roughness:.18,transparent:true,opacity:.095,depthWrite:false
  }));
  foil.scale.set(.989,.989,.80);foil.position.z=-.12;logoGroup.add(foil);
  const outline=new THREE.LineSegments(
    new THREE.EdgesGeometry(logoGeometry,18),
    new THREE.LineBasicMaterial({color:0xb1842c,transparent:true,opacity:.95})
  );
  logoGroup.add(outline);
  // A directional front-face coating creates crisp studio reflections without
  // turning the transmissive glass core into a flat opaque lightning slab.
  const sheenMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.FrontSide,
    vertexShader:`
      varying vec3 vLocal;
      varying vec3 vViewNormal;
      void main() {
        vLocal=position;
        vViewNormal=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying vec3 vLocal;
      varying vec3 vViewNormal;
      void main() {
        float broad=exp(-pow((vLocal.x*.68+vLocal.y*.26-.29)*3.8,2.0));
        float narrow=exp(-pow((vLocal.x*.62+vLocal.y*.22+.53)*8.0,2.0));
        float edge=pow(1.0-abs(vViewNormal.z),2.0);
        float reflection=clamp(broad*.24+narrow*.13+edge*.17,0.0,.45);
        vec3 cool=vec3(.82,.90,1.0);
        vec3 warm=vec3(1.0,.94,.75);
        vec3 tint=mix(cool,warm,smoothstep(-1.7,1.7,vLocal.y)*.25);
        gl_FragColor=vec4(tint,reflection);
      }
    `
  });
  const sheen=new THREE.Mesh(logoGeometry.clone(),sheenMaterial);
  sheen.position.z=.017;
  sheen.renderOrder=2;
  logoGroup.add(sheen);

  const modalityY=[2.25,1.60,.95,.30,-.35,-1.0,-1.65,-2.30];
  const serviceY=[2.15,1.29,.43,-.43,-1.29,-2.15];
  const points=new Map();
  const pickMeshes=[];
  const accentMaterials=[];
  const colors={model:0x6588bd,service:0xc49a3e};
  function addMarker(id,x,y,z,type) {
    const color=colors[type];
    const geo=type==="model"
      ?new THREE.BoxGeometry(.15,.15,.09)
      :new THREE.BoxGeometry(.18,.18,.16);
    const mat=new THREE.MeshPhysicalMaterial({
      color,metalness:.4,roughness:.22,clearcoat:.85,
      clearcoatRoughness:.1,emissive:color,emissiveIntensity:.08
    });
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(x,y,z);
    graph.add(mesh);
    // A single marker has a single meaning: a real listed capability.
    const pick=new THREE.Mesh(new THREE.SphereGeometry(.26,8,6),
      new THREE.MeshBasicMaterial({visible:false}));
    pick.position.copy(mesh.position);pick.userData.id=id;
    graph.add(pick);pickMeshes.push(pick);
    const pos=mesh.position.clone();
    points.set(id,{mesh,pos,mat,type});
    accentMaterials.push(mat);
  }
  MODALITY_NAMES.forEach((id,i)=>addMarker(id,-3.44,modalityY[i],-.28,"model"));
  SERVICE_NAMES.forEach((id,i)=>addMarker(id,3.44,serviceY[i],-.28,"service"));

  const lines=[];
  const defaultLine=0x8a9aaf;
  function connect(id,from,to,controlPoints,kind) {
    const curve=new THREE.CatmullRomCurve3([from,...controlPoints,to]);
    const geo=new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const mat=new THREE.LineBasicMaterial({
      color:kind==="backbone"?0xcfaa51:defaultLine,
      transparent:true,opacity:kind==="backbone"?.55:.24,depthWrite:false
    });
    const line=new THREE.Line(geo,mat);
    graph.add(line);
    const packet=new THREE.Mesh(new THREE.BoxGeometry(.065,.065,.065),
      new THREE.MeshBasicMaterial({color:0xf0ce70,transparent:true,opacity:0}));
    graph.add(packet);
    lines.push({id,curve,mat,packet,kind});
  }
  const inputHub=new THREE.Vector3(-1.38,0,-.17);
  const outputHub=new THREE.Vector3(1.38,0,-.17);
  const origin=new THREE.Vector3(0,0,-.17);
  MODALITY_NAMES.forEach((id,i)=>{
    const src=points.get(id).pos;
    connect(id,src,inputHub,[
      new THREE.Vector3(-2.85,src.y,-.28),
      new THREE.Vector3(-2.15,src.y*.53,-.24)
    ],"input");
  });
  connect("backbone-input",inputHub,origin,[
    new THREE.Vector3(-1.05,0,-.17)
  ],"backbone");
  connect("backbone-output",origin,outputHub,[
    new THREE.Vector3(1.05,0,-.17)
  ],"backbone");
  SERVICE_NAMES.forEach((id,i)=>{
    const dst=points.get(id).pos;
    connect(id,outputHub,dst,[
      new THREE.Vector3(2.10,dst.y*.53,-.24),
      new THREE.Vector3(2.85,dst.y,-.28)
    ],"output");
  });
  // Only these cross-service links are true relationships:
  // deployments use Buckets for weights; agents can be protected by Shield;
  // organizations govern the shared console.
  const RELATIONS=[
    ["deployments","buckets"],
    ["agents","shield"],
    ["organizations","console"]
  ];
  const cross=[];
  for(const [a,b] of RELATIONS) {
    const start=points.get(a).pos,end=points.get(b).pos;
    const curved=new THREE.CatmullRomCurve3([
      start,new THREE.Vector3(4.08,(start.y+end.y)/2,-.88),end
    ]);
    const mat=new THREE.LineBasicMaterial({
      color:0xa68c51,transparent:true,opacity:.035,depthWrite:false
    });
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curved.getPoints(26)),mat);
    graph.add(line);cross.push({a,b,mat});
  }

  // Two structural columns replace the decorative orbits of the old design.
  const railMaterial=new THREE.LineBasicMaterial({
    color:0x8797ad,transparent:true,opacity:.17,depthWrite:false
  });
  for(const x of [-3.44,3.44]) {
    const railGeo=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x,2.55,-.48),new THREE.Vector3(x,-2.55,-.48)
    ]);
    graph.add(new THREE.Line(railGeo,railMaterial));
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let selected=null,active=false,dead=false,raf=0,last=0,time=0;
  let pitch=0,yaw=0,drag=null,themeDark=false;
  let observer=null;
  function updateTheme() {
    themeDark=document.documentElement.getAttribute("data-theme")==="dark";
    const lineColor=themeDark?0x9cacc8:0x73839a;
    for(const l of lines)if(l.kind!=="backbone")l.mat.color.setHex(lineColor);
    railMaterial.color.setHex(lineColor);
    glass.color.setHex(themeDark?0xc8d9e9:0xd0dce6);
    foil.material.color.setHex(themeDark?0x8296b7:0xa6bbca);
    foil.material.opacity=themeDark?.13:.095;
    outline.material.color.setHex(themeDark?0xffd66f:0x9c792f);
    outline.material.opacity=themeDark?.95:.88;
    for(const {mat,type} of points.values()) {
      mat.color.setHex(type==="model"?(themeDark?0x91b2fd:0x5375ac):(themeDark?0xf5cf72:0xb18a37));
    }
  }
  function setSelected(id) {
    selected=CAPABILITIES[id]?id:null;
    const inModels=MODALITY_NAMES.includes(selected);
    const inServices=SERVICE_NAMES.includes(selected);
    for(const line of lines) {
      const highlighted=selected && (line.id===selected ||
        (line.kind==="backbone" && (inModels||inServices)));
      line.mat.opacity=selected?(highlighted?.93:.085):(line.kind==="backbone"?.55:.22);
      line.packet.material.opacity=highlighted?.98:0;
      line.packet.visible=Boolean(highlighted);
    }
    for(const [id,point] of points) {
      point.mesh.scale.setScalar(selected===id?1.75:1);
      point.mat.emissiveIntensity=selected===id?.6:.08;
      point.mesh.material.opacity=selected&&selected!==id?.6:1;
    }
    for(const relation of cross) {
      relation.mat.opacity=selected && (selected===relation.a||selected===relation.b)?.55:.035;
    }
  }

  function resize() {
    const w=Math.max(stage.clientWidth,240),h=Math.max(stage.clientHeight,260);
    camera.aspect=w/h;
    const narrow=mobile.matches;
    camera.position.set(0,0,narrow?14.6:12.8);
    camera.updateProjectionMatrix();
    graph.scale.set(narrow?.81:1,narrow?.88:1,1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,narrow?1.3:1.65));
    renderer.setSize(w,h,false);
    renderer.render(scene,camera);
  }
  function hit(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    pointer.set(
      (event.clientX-rect.left)/rect.width*2-1,
      -(event.clientY-rect.top)/rect.height*2+1
    );
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(pickMeshes,false)[0]?.object.userData.id||null;
  }
  function onDown(e) {
    if(e.target.closest?.("a"))return;
    drag={x:e.clientX,y:e.clientY,baseYaw:yaw,basePitch:pitch,moved:false};
  }
  function onMove(e) {
    if(drag) {
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>9) drag.moved=true;
      if(Math.abs(dx)>Math.abs(dy) || e.pointerType!=="touch") {
        yaw=Math.max(-.16,Math.min(.16,drag.baseYaw+dx*.0016));
        pitch=Math.max(-.09,Math.min(.09,drag.basePitch+dy*.001));
      }
      return;
    }
    if(e.pointerType==="touch")return;
    const id=hit(e);
    renderer.domElement.style.cursor=id?"pointer":"grab";
    if(id)onPick(id);
  }
  function onUp(e) {
    if(!drag)return;
    const wasMoved=drag.moved;
    drag=null;
    if(wasMoved)return;
    const id=hit(e);
    if(id)onPick(id);
  }
  function onLeave(){drag=null;renderer.domElement.style.cursor="default";}
  stage.addEventListener("pointerdown",onDown,{passive:true});
  stage.addEventListener("pointermove",onMove,{passive:true});
  stage.addEventListener("pointerup",onUp);
  stage.addEventListener("pointercancel",onLeave);
  stage.addEventListener("pointerleave",onLeave);
  const onContextLost=e=>{e.preventDefault();destroy();onFailure?.();};
  renderer.domElement.addEventListener("webglcontextlost",onContextLost,false);
  const onVisibility=()=>document.visibilityState==="hidden"?pause():start();
  document.addEventListener("visibilitychange",onVisibility);
  if("ResizeObserver" in window){observer=new ResizeObserver(resize);observer.observe(stage);}
  else window.addEventListener("resize",resize);
  updateTheme();resize();setSelected(null);

  function tick(now) {
    if(dead||!active){raf=0;return;}
    raf=requestAnimationFrame(tick);
    const interval=mobile.matches?1000/24:1000/30;
    if(now-last<interval)return;
    const delta=last?Math.min((now-last)/1000,.08):0;
    last=now;time+=delta;
    graph.rotation.y+=(yaw+Math.sin(time*.18)*.035-graph.rotation.y)*.045;
    graph.rotation.x+=(pitch-graph.rotation.x)*.045;
    // Only the logo moves slightly. The architecture stays spatially stable.
    logoGroup.rotation.y=.32+Math.sin(time*.24)*.16;
    logoGroup.rotation.x=.10+Math.sin(time*.17)*.07;
    for(const [i,l] of lines.entries()) {
      if(!l.packet.visible)continue;
      l.packet.position.copy(l.curve.getPoint((time*.16+i*.1)%1));
    }
    renderer.render(scene,camera);
  }
  function start() {
    if(dead||active||document.visibilityState==="hidden")return;
    active=true;last=0;raf=requestAnimationFrame(tick);
  }
  function pause() {active=false;if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
  function destroy() {
    if(dead)return;
    dead=true;pause();
    observer?.disconnect();
    if(!observer)window.removeEventListener("resize",resize);
    document.removeEventListener("visibilitychange",onVisibility);
    stage.removeEventListener("pointerdown",onDown);
    stage.removeEventListener("pointermove",onMove);
    stage.removeEventListener("pointerup",onUp);
    stage.removeEventListener("pointercancel",onLeave);
    stage.removeEventListener("pointerleave",onLeave);
    renderer.domElement.removeEventListener("webglcontextlost",onContextLost);
    const materials=new Set(),geometries=new Set();
    scene.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      if(object.material) {
        if(Array.isArray(object.material))object.material.forEach(m=>materials.add(m));
        else materials.add(object.material);
      }
    });
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    env.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  return {start,pause,destroy,setSelected,updateTheme};
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",initTopology,{once:true});
}else initTopology();
