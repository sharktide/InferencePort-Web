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
