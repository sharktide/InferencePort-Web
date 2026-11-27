/**
 * Browser-level homepage test. Run:
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *   python3 -m http.server 4173 --bind 127.0.0.1 &
 *   node tests/home-topology-browser.cjs
 *
 * CI uploads screenshots for human visual review; no fake benchmark metrics.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit,devices}=require("playwright");

const root=path.resolve(__dirname,"..");
const screenshots=path.join(root,"test-results","home-topology");
fs.mkdirSync(screenshots,{recursive:true});
const BASE=process.env.HOME_TEST_URL||"http://127.0.0.1:4173";

async function checkScene(page,name) {
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  const shell=page.locator("#lp-topology");
  await shell.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{
    const element=document.querySelector("#lp-topology");
    return element?.classList.contains("has-webgl")||element?.dataset.fallback;
  },null,{timeout:30000});
  const status=await shell.evaluate(el=>({
    webgl:el.classList.contains("has-webgl"),
    fallback:el.dataset.fallback||null,
    nodes:el.querySelectorAll("[data-graph-node]").length,
    canvas:el.querySelectorAll("canvas.ip-architecture-webgl").length
  }));
  assert.equal(status.webgl,true,name+" did not render Three.js: "+JSON.stringify(status));
  assert.equal(status.nodes,14,name+" missing capability links");
  assert.equal(status.canvas,1,name+" missing rendered canvas");
  await page.locator("#lp-topology").screenshot({
    path:path.join(screenshots,name+"-light.png")
  });
  // Full-section capture catches layout integration mistakes that a cropped
  // scene screenshot misses (hero positioning, spacing, and headline overlap).
  await page.locator(".lp-hero").screenshot({
    path:path.join(screenshots,name+"-full-hero.png")
  });
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
  await page.waitForTimeout(300);
  await page.locator("#lp-topology").screenshot({
    path:path.join(screenshots,name+"-dark.png")
  });
  await page.evaluate(()=>document.documentElement.setAttribute("data-theme","light"));

  // The graph interaction must explain a real capability and highlight its link.
  if(name==="mobile") {
    await page.getByRole("tab",{name:"Infrastructure"}).click();
    assert.equal(await page.locator("#ip-layer-models").isVisible(),false);
    assert.equal(await page.locator("#ip-layer-services").isVisible(),true);
    assert.match(await page.locator("[data-graph-title]").innerText(),/Managed agents/);
  }
  const bucket=page.locator('[data-graph-node="buckets"]');
  await bucket.scrollIntoViewIfNeeded();
  if(name==="mobile") {
    await bucket.click();
  }else{
    await bucket.hover();
  }
  assert.match(await page.locator("[data-graph-title]").innerText(),/Buckets/);
  assert.match(await page.locator("[data-graph-description]").innerText(),/S3-compatible/);
  assert.equal(await bucket.getAttribute("aria-current"),"true");
  assert.equal(await page.locator("[data-graph-link]").getAttribute("href"),"#buckets");
  await shell.screenshot({path:path.join(screenshots,name+"-buckets-selected.png")});

  // A full two-axis drag must keep WebGL live and allow pointer rotation.
  const canvas=page.locator("canvas.ip-architecture-webgl");
  const region=await canvas.boundingBox();
  assert.ok(region,"WebGL canvas did not have a bounding box");
  await page.mouse.move(region.x+region.width*.54,region.y+region.height*.48);
  await page.mouse.down();
  await page.mouse.move(region.x+region.width*.17,region.y+region.height*.78,{steps:10});
  await page.mouse.up();
  assert.equal(await shell.evaluate(el=>el.classList.contains("has-webgl")),true);
  // Deliberately repeat large drags to reproduce the user-reported upside-down
  // scene. The product/network map must never rotate beyond safe angles.
  for(let i=0;i<3;i++){
    await page.mouse.move(region.x+region.width*.15,region.y+region.height*.20);
    await page.mouse.down();
    await page.mouse.move(region.x+region.width*.90,region.y+region.height*.85,{steps:10});
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
  const tilt=await page.locator(".ip-architecture-stage").evaluate(el=>({
    yaw:Number(el.dataset.graphYaw),pitch:Number(el.dataset.graphPitch)
  }));
  assert.ok(Number.isFinite(tilt.yaw)&&Number.isFinite(tilt.pitch),
    name+" missing 3D scene diagnostics");
  assert.ok(Math.abs(tilt.yaw)<=.205&&Math.abs(tilt.pitch)<=.11,
    name+" graph flipped under repeated drag: "+JSON.stringify(tilt));
  await page.locator("#lp-topology").screenshot({
    path:path.join(screenshots,name+"-extreme-drag-bounded.png")
  });
  await page.getByRole("button",{name:"Reset 3D view"}).click();
  await page.waitForTimeout(900);
  const resetTilt=await page.locator(".ip-architecture-stage").evaluate(el=>({
    yaw:Number(el.dataset.graphYaw),pitch:Number(el.dataset.graphPitch)
  }));
  assert.ok(Math.abs(resetTilt.yaw)<.10&&Math.abs(resetTilt.pitch)<.065,
    name+" reset view failed: "+JSON.stringify(resetTilt));

  // Catch theme-specific illegible panels (such as pale text on a pale
  // surface), which can pass structural tests but fail a real screenshot QA.
  const agentsContrast=await page.locator("#agents .lp-proof-copy").evaluate(panel=>{
    const rgb=(value)=>[...value.matchAll(/[\d.]+/g)].slice(0,3).map(x=>Number(x[0])/255);
    const luminosity=value=>rgb(value).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
      .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const bg=luminosity(getComputedStyle(panel).backgroundColor);
    const headings=panel.querySelectorAll("h3,p");
    return [...headings].map(element=>{
      const lum=luminosity(getComputedStyle(element).color);
      return (Math.max(bg,lum)+.05)/(Math.min(bg,lum)+.05);
    });
  });
  assert.ok(agentsContrast.every(value=>value>=4.5),
    name+" Agent story contrast is not accessible: "+JSON.stringify(agentsContrast));

  // Visual QA of the areas that used to be cramped card walls.
  assert.equal(await page.locator(".lp-ecosystem-spotlight").count(),4);
  assert.equal(await page.locator(".lp-proof-compact").count(),2);
  await page.locator("#platform-details").screenshot({
    path:path.join(screenshots,name+"-infrastructure.png")
  });
  await page.locator(".lp-section.lp-more").screenshot({
    path:path.join(screenshots,name+"-ecosystem.png")
  });
  // Real primary CTAs and distinct illustrative visuals, not tiny inert links.
  assert.equal(await page.locator("#deploy .lp-proof-link").getAttribute("href"),"/console/deploy");
  assert.equal(await page.locator("#deploy .lp-preview-action").getAttribute("href"),"/console/deploy");
  const ctas=await page.locator(".lp-proof-link").evaluateAll(links=>links.map(el=>({
    text:el.textContent.trim(),height:el.getBoundingClientRect().height,
    bg:getComputedStyle(el).backgroundColor
  })));
  assert.ok(ctas.every(x=>x.height>=43&&x.bg!=="rgba(0, 0, 0, 0)"),
    name+" invisible CTA: "+JSON.stringify(ctas));
  const colors=await page.evaluate(()=>[
    ".lp-deploy-preview",".lp-bucket-visual",".lp-council-visual"
  ].map(sel=>getComputedStyle(document.querySelector(sel)).borderTopColor));
  assert.equal(new Set(colors).size,3,"Preview colors should distinguish products");
  const workspacePadding=await page.locator("#console").evaluate(
    el=>parseFloat(getComputedStyle(el).paddingLeft));
  assert.ok(workspacePadding>=19,name+" workspace padding collapsed: "+workspacePadding);

  // Main-site product detail is restored while keeping concise product stories.
  const richSections=["agents","deploy","buckets","shield"];
  // The API workbench follows the product directory.
  assert.equal(await page.locator(".lp-hero-demo").count(),0);
  assert.equal(await page.locator("#quickstart [data-example-tab]").count(),8);
  assert.equal(await page.locator("#quickstart [data-example-panel]").count(),8);
  assert.equal(await page.locator("#quickstart [data-example-panel]:not([hidden])").count(),1);
  assert.ok(await page.locator("#quickstart").evaluate(el=>{
    const pricing=document.querySelector("#pricing");
    return pricing && el.compareDocumentPosition(pricing)&Node.DOCUMENT_POSITION_FOLLOWING;
  }),name+" quickstart should precede pricing");
  for(const id of richSections){
    const element=page.locator('[id="'+id+'"] .lp-feature-points').first();
    assert.equal(await element.count(),1,name+" missing rich feature descriptions for "+id);
    assert.equal(await element.locator("li").count(),id==="shield"?5:3,name+" should show specific feature detail for "+id);
  }
  const desktopImage=page.locator(".lp-desktop-window img");
  await desktopImage.scrollIntoViewIfNeeded();
  await desktopImage.evaluate(img=>img.decode());
  const imgInfo=await desktopImage.evaluate(img=>({
    width:img.naturalWidth,height:img.naturalHeight
  }));
  assert.ok(imgInfo.width>100&&imgInfo.height>100,
    name+" original desktop screenshot did not load "+JSON.stringify(imgInfo));
  await page.locator("#app").screenshot({
    path:path.join(screenshots,name+"-desktop-product-detail.png")
  });
  // Every illustrative demo should convey a specific product workflow, not
  // repeated feature chips on generic gradient cards.
  const productPreviews=[
    ["shield",".lp-shield-demo",".lp-shield-json"],
    ["council",".lp-council-visual",".lp-council-voices"],
    ["cli",".lp-cli-visual",".lp-cli-terminal-body"],
    ["lightning",".lp-lightning-preview",".lp-lightning-conversation"],
    ["app",".lp-desktop-visual",".lp-desktop-window img"]
  ];
  for(const [product,container,content] of productPreviews){
    assert.equal(await page.locator("#"+product+" "+container).count(),1,
      name+" missing "+product+" product interface");
    assert.ok(await page.locator("#"+product+" "+content).isVisible(),
      name+" missing visible "+product+" workflow");
    await page.locator("#"+product).screenshot({
      path:path.join(screenshots,name+"-"+product+"-proof.png")
    });
  }
  assert.match(await page.locator("#lightning h3").innerText(),/Lightning: chat and create/);
  assert.ok(await page.locator("#shield .lp-feature-points li").count()>=5);


  // Geometry is not allowed to produce horizontal page overflow.
  const measurements=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:document.documentElement.clientWidth,
    sceneWidth:document.querySelector("#lp-topology").getBoundingClientRect().width
  }));
  assert.ok(measurements.documentWidth<=measurements.viewportWidth+2,
    name+" introduces horizontal overflow "+JSON.stringify(measurements));
  // Simulate the WebGL context-loss event and verify that the live scene
  // clears while all the meaningful links and SVG remain available.
  await page.locator("canvas.ip-architecture-webgl").evaluate(canvas=>{
    canvas.dispatchEvent(new Event("webglcontextlost",{cancelable:true}));
  });
  await page.waitForFunction(()=>{
    const el=document.querySelector("#lp-topology");
    return el?.dataset.fallback==="context-lost" && !el.classList.contains("has-webgl");
  });
  assert.equal(await page.locator("#lp-topology [data-graph-node]").count(),14);

}


async function checkWeather(browser) {
  const context=await browser.newContext({
    viewport:{width:1728,height:900},deviceScaleFactor:1,
    reducedMotion:"no-preference"
  });
  try {
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error)));
    await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>document.querySelector("#lp-weather canvas")?.width>1400);
    const weather=page.locator("#lp-weather");
    const canvas=weather.locator("canvas.lp-weather-canvas");
    assert.equal(await weather.getAttribute("aria-hidden"),"true");
    assert.equal(await weather.evaluate(el=>getComputedStyle(el).pointerEvents),"none");
    assert.equal(await weather.locator(".lp-weather-rail").count(),0,
      "No more clipped SVG side clouds");
    const size=await canvas.evaluate(el=>({width:el.width,height:el.height,
      x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}));
    assert.ok(size.width>=1728&&size.height>=900,
      "Continuous weather canvas must span the viewport: "+JSON.stringify(size));
    // Assess the real, final quickstart copy against its own surface, not
    // a removed hero feature list.
    const quickstart=await page.locator("#quickstart .lp-quickstart-summary p").evaluate(el=>{
      const rgb=s=>[...s.matchAll(/[\d.]+/g)].slice(0,3).map(m=>Number(m[0])/255);
      const lum=s=>rgb(s).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
        .reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
      const text=lum(getComputedStyle(el).color);
      const bg=lum(getComputedStyle(document.querySelector("#quickstart")).backgroundColor);
      return {contrast:(Math.max(text,bg)+.05)/(Math.min(text,bg)+.05),
        color:getComputedStyle(el).color};
    });
    assert.ok(quickstart.contrast>=4.5,
      "Light-mode final API quickstart text lacks contrast "+JSON.stringify(quickstart));
    await page.screenshot({path:path.join(screenshots,"atmosphere-light-hero.png")});
    const initial=Number(await weather.getAttribute("data-weather-scroll"))||0;
    for(const [id,phase] of [["buckets","rain"],["shield","charged"],["lightning","electric"]]){
      await page.evaluate(id=>{
        const el=document.getElementById(id);
        const center=window.scrollY+el.getBoundingClientRect().top+el.offsetHeight*.42;
        window.scrollTo(0,center-window.innerHeight*.58);
      },id);
      await page.waitForFunction(expected=>document.querySelector("#lp-weather")?.dataset.phase===expected,
        phase,{timeout:10000});
      await page.waitForTimeout(240);
      await page.screenshot({path:path.join(screenshots,"atmosphere-"+phase+".png")});
    }
    const motion=Number(await weather.getAttribute("data-weather-scroll"));
    assert.ok(motion>initial+500,
      "Clouds must respond continuously to page scrolling: "+initial+" -> "+motion);
    const centerAlpha=await canvas.evaluate(el=>{
      const g=el.getContext("2d");
      return g.getImageData(Math.floor(el.width/2),Math.floor(el.height/2),1,1).data[3];
    });
    assert.equal(centerAlpha,0,"Weather must fade fully out over the central product content");
    await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(screenshots,"atmosphere-dark.png")});
    const overflow=await page.evaluate(()=>({
      page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth
    }));
    assert.ok(overflow.page<=overflow.viewport+2,
      "Weather must not create horizontal overflow: "+JSON.stringify(overflow));
    await page.setViewportSize({width:1100,height:820});
    await page.waitForFunction(()=>document.querySelector("#lp-weather canvas")?.width>=1100);
    await page.setViewportSize({width:820,height:820});
    await page.waitForFunction(()=>document.querySelector("#lp-weather")?.children.length===0);
    assert.equal(await weather.isVisible(),false,"Disable weather when viewport is narrow");
    assert.deepEqual(errors,[],"Unexpected atmospheric canvas browser errors");
  }finally{await context.close();}

  const still=await browser.newContext({
    viewport:{width:1728,height:900},reducedMotion:"reduce"
  });
  try{
    const page=await still.newPage();
    await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
    const result=await page.locator("#lp-weather").evaluate(el=>({
      children:el.children.length,visible:getComputedStyle(el).display
    }));
    assert.equal(result.children,0,"Reduced-motion users must get no animation canvas");
    assert.equal(result.visible,"none");
  }finally{await still.close();}
}

(async()=>{
  const browser=await chromium.launch({
    headless:true,
    args:[
      "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
      "--enable-unsafe-swiftshader","--ignore-gpu-blocklist"
    ]
  });
  try {
    const desktop=await browser.newContext({
      viewport:{width:1440,height:900},deviceScaleFactor:1,
      reducedMotion:"no-preference"
    });
    const desktopPage=await desktop.newPage();
    await checkScene(desktopPage,"desktop");
    await desktop.close();
    await checkWeather(browser);

    const mobile=await browser.newContext({
      ...devices["iPhone 13"],
      reducedMotion:"no-preference"
    });
    await checkScene(await mobile.newPage(),"mobile");
    await mobile.close();

    const reduced=await browser.newContext({
      viewport:{width:390,height:844},deviceScaleFactor:2,
      reducedMotion:"reduce"
    });
    const reducedPage=await reduced.newPage();
    await reducedPage.goto(BASE+"/",{waitUntil:"domcontentloaded"});
    await reducedPage.locator("#lp-topology").scrollIntoViewIfNeeded();
    await reducedPage.waitForTimeout(300);
    assert.equal(await reducedPage.locator("#lp-topology").evaluate(
      el=>el.classList.contains("has-webgl")),false,"Reduced motion started WebGL");
    assert.equal(await reducedPage.locator("#lp-topology canvas").count(),0,
      "Reduced-motion fallback should not allocate WebGL");
    assert.equal(await reducedPage.locator("#lp-topology [data-graph-node]").count(),14,
      "Reduced-motion fallback must preserve all navigation links");
    await reducedPage.locator("#lp-topology").screenshot({
      path:path.join(screenshots,"mobile-reduced-motion.png")
    });
    await reduced.close();
    // WebKit desktop-linux is the nearest available automated Safari engine.
    // Its software rasterizer may use the static fallback, but the layout and
    // accessible interaction must remain correct in either case.
    const webkitBrowser=await webkit.launch({headless:true});
    try {
      const safari=await webkitBrowser.newContext({
        ...devices["iPhone 13"],reducedMotion:"no-preference"
      });
      const safariPage=await safari.newPage();
      const safariErrors=[];
      safariPage.on("pageerror",e=>safariErrors.push(String(e)));
      await safariPage.goto(BASE+"/",{waitUntil:"domcontentloaded"});
      const safariShell=safariPage.locator("#lp-topology");
      await safariShell.scrollIntoViewIfNeeded();
      await safariPage.waitForTimeout(1200);
      assert.equal(await safariPage.locator("[data-graph-node]").count(),14);
      await safariShell.screenshot({path:path.join(screenshots,"mobile-webkit.png")});
      await safariPage.getByRole("tab",{name:"Infrastructure"}).click();
      assert.match(await safariPage.locator("[data-graph-title]").innerText(),/Managed agents/);
      await safariPage.locator('[data-graph-node="shield"]').click();
      assert.match(await safariPage.locator("[data-graph-title]").innerText(),/Shield/);
      assert.deepEqual(safariErrors,[],"WebKit page errors");
      await safari.close();
    }finally{
      await webkitBrowser.close();
    }
    console.log("Browser E2E checks passed: Chromium desktop/mobile WebGL; WebKit mobile layout, interaction and reduced-motion.");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
