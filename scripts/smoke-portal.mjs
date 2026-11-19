import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const port = 8765;
const origin = "http://127.0.0.1:" + port;
const galaxyPath = "/PhotoGallery/galaxy/";
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: process.cwd(),
  stdio: "ignore"
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Local portal HTTP server failed to start");
}

async function waitForRocketFrame(page) {
  try {
    await page.waitForFunction(() => {
      const frame = document.getElementById("rocket-warp-frame");
      return Boolean(frame?.contentWindow?.__ROCKET_WARP_READY__ || frame?.contentWindow?.__ROCKET_WARP_ERROR__);
    }, null, { timeout: 24000 });
  } catch (error) {
    console.error("Frame-load diagnostics:", JSON.stringify(await page.evaluate(() => {
      const frame = document.getElementById("rocket-warp-frame");
      let child = null;
      try {
        child = { ready:frame?.contentWindow?.__ROCKET_WARP_READY__, error:frame?.contentWindow?.__ROCKET_WARP_ERROR__, readyState:frame?.contentWindow?.document?.readyState };
      } catch(e) { child={accessError:String(e)}; }
      if(child) {
        try {
          const w=frame.contentWindow;
          child.bootstrap=w.__ROCKET_INLINE_BOOTSTRAP__;
          child.moduleEvaluated=w.__ROCKET_MODULE_EVALUATED__;
          child.bootError=w.__ROCKET_BOOT_ERROR__;
          child.rejection=w.__ROCKET_BOOT_REJECTION__;
          child.documentTitle=w.document.title;
          child.canvas={width:w.document.getElementById("cosmos-canvas")?.width,height:w.document.getElementById("cosmos-canvas")?.height};
          child.resources=w.performance.getEntriesByType("resource").filter(r=>/three|tailwind|font/i.test(r.name)).map(r=>({name:r.name,duration:r.duration,transfer:r.transferSize}));
        }catch(e){child.inspectionError=String(e);}
      }
      return {iframeSrc:frame?.src, child};
    })));
    throw error;
  }
  const frame = page.frame({ url: /assets\/rocket-warp\.html/ });
  if (!frame) console.error("Rocket iframe missing; present frames:",page.frames().map(f=>f.url()));
  assert.ok(frame, "same-origin 3D rocket frame must be available");
  await frame.waitForFunction(() => window.__ROCKET_WARP_READY__ === true || Boolean(window.__ROCKET_WARP_ERROR__), null, { timeout: 45000 });
  const status = await frame.evaluate(() => ({
    ready: window.__ROCKET_WARP_READY__ === true,
    error: window.__ROCKET_WARP_ERROR__ || ""
  }));
  assert.equal(status.ready, true, "3D rocket/black-hole WebGL engine failed: " + status.error);
  return frame;
}

try {
  await waitForServer();
  const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
  browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox","--disable-dev-shm-usage","--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
  });

  const catalogResponse = await fetch("https://yixuanqi.github.io/PhotoGallery/projects.json");
  assert.equal(catalogResponse.status, 200, "Published catalog must be reachable");
  const catalog = await catalogResponse.json();
  assert.equal(catalog.projects.length, 12, "Baseline catalog contains 12 projects");

  await mkdir(resolve("screenshots"), { recursive: true });
  for (const viewport of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    const popups = [];
    page.on("pageerror", error => {errors.push(error.message); console.error("Browser JS exception:",error.message);});
    page.on("console", msg => { if(msg.type()==="error") console.error("Browser console:",msg.text().slice(0,600)); });
    page.on("requestfailed", req => console.error("Failed request:",req.url(),req.failure()?.errorText));
    page.on("popup", popup => popups.push(popup));
    await page.route("https://yixuanqi.github.io/PhotoGallery/projects.json**", route =>
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(catalog)}));
    await page.goto(origin,{waitUntil:"load",timeout:45000});
    const rocketFrame = await waitForRocketFrame(page);
    await page.waitForFunction(()=>document.querySelectorAll(".project-card").length===12,null,{timeout:20000});
    await rocketFrame.evaluate(()=>document.fonts.ready.then(()=>true));
    await page.waitForTimeout(350);

    assert.equal(await page.locator("#rocket-warp-frame").count(),1,"Exactly one isolated rocket scene");
    assert.equal(await page.locator("#cosmos-canvas").count(),0,"Parent page must not run a duplicate WebGL canvas");
    assert.equal(await rocketFrame.locator("#cosmos-canvas").count(),1,"Reference scene owns exactly one WebGL canvas");
    assert.equal((await rocketFrame.locator("#caption-main").innerText()).trim(),"星海漫游","Hero keeps only the single 星海漫游 label");
    assert.equal(await rocketFrame.locator("#hud-root > div:first-child").evaluate(el=>getComputedStyle(el).display),"none","Reference tuning/status HUD stays hidden");
    assert.equal(await rocketFrame.locator("#rocket-caption > span:nth-child(2)").evaluate(el=>getComputedStyle(el).display),"none","No extra helper copy is visible");
    assert.equal(await rocketFrame.locator("#handoff-curtain").count(),1,"A handoff curtain must cover the final transition");

    const measured=await page.evaluate(()=>{
      const frame=document.getElementById("rocket-warp-frame");
      const rect=frame.getBoundingClientRect();
      const canvas=frame.contentWindow.document.getElementById("cosmos-canvas");
      return {
        frameLeft:rect.left,frameRight:rect.right,frameTop:rect.top,frameBottom:rect.bottom,
        canvasWidth:canvas.width,canvasHeight:canvas.height,
        webglContext:Boolean(canvas.getContext("webgl2")||canvas.getContext("webgl")),
        hasHorizontalOverflow:document.documentElement.scrollWidth>innerWidth+2
      };
    });
    assert.equal(measured.hasHorizontalOverflow,false,viewport.name+" horizontal overflow");
    assert.ok(measured.frameLeft<=1&&measured.frameRight>=viewport.width-1,viewport.name+" scene must be full bleed");
    assert.ok(Math.abs(measured.frameTop)<1 && measured.frameBottom>=viewport.height-1,
      viewport.name+" initial 3D scene must start at the top edge and fill behind the navigation");
    const headerStyle=await page.locator(".site-header").evaluate(el=>{
      const style=getComputedStyle(el);
      const box=el.getBoundingClientRect();
      return {
        position:style.position,backgroundImage:style.backgroundImage,
        backgroundColor:style.backgroundColor,borderBottom:style.borderBottomWidth,
        top:box.top
      };
    });
    assert.equal(headerStyle.position,"absolute",viewport.name+" navigation must float above the hero");
    assert.equal(headerStyle.backgroundImage,"none",viewport.name+" dark navigation gradient must be removed");
    assert.equal(headerStyle.backgroundColor,"rgba(0, 0, 0, 0)",viewport.name+" navigation must be transparent");
    assert.equal(headerStyle.borderBottom,"0px",viewport.name+" navigation divider must be removed");
    assert.ok(Math.abs(headerStyle.top)<1,viewport.name+" navigation must overlay top of the starfield");
    assert.ok(measured.canvasWidth>0&&measured.canvasHeight>0&&measured.webglContext,viewport.name+" WebGL canvas inactive");
    assert.deepEqual(errors,[],viewport.name+" uncaught browser errors");
    assert.deepEqual(popups,[],viewport.name+" must not open popups");
    await page.screenshot({path:resolve("screenshots",viewport.name+".png"),fullPage:false});

    // Simulate launch at each breakpoint; the same iframe must continue to
    // cover the whole viewport without shifting or reloading its WebGL scene.
    await page.evaluate(() => document.body.classList.add("rocket-launching"));
    await page.waitForFunction(() => {
      const box = document.getElementById("rocket-warp-frame").getBoundingClientRect();
      return Math.abs(box.top) < 1 && Math.abs(box.left) < 1 &&
        Math.abs(box.right - innerWidth) < 1 && Math.abs(box.bottom - innerHeight) < 1;
    }, null, { timeout: 4000 });
    const launchCoverage = await page.evaluate(() => {
      const frame = document.getElementById("rocket-warp-frame");
      const rect = frame.getBoundingClientRect();
      const canvas = frame.contentWindow.document.getElementById("cosmos-canvas");
      return {
        top:rect.top,left:rect.left,width:rect.width,height:rect.height,
        viewportWidth:innerWidth,viewportHeight:innerHeight,
        canvasWidth:canvas.width,canvasHeight:canvas.height,
        frameStillLoaded:frame.contentWindow.__ROCKET_WARP_READY__ === true
      };
    });
    assert.ok(launchCoverage.frameStillLoaded,"Fullscreen expansion must not reload the 3D scene");
    assert.ok(Math.abs(launchCoverage.top)<1 && Math.abs(launchCoverage.height-launchCoverage.viewportHeight)<1,
      viewport.name+" launched scene must eliminate the header-height black strip");
    await page.screenshot({path:resolve("screenshots",viewport.name+"-fullscreen.png"),fullPage:false});
    await page.evaluate(() => document.body.classList.remove("rocket-launching"));

    if(viewport.name==="desktop"){
      const search=page.locator("#project-search");
      await search.fill("引力透镜");
      assert.equal(await page.locator(".project-card").count(),1,"Search filters by name");
      await search.fill("");
      await page.locator('button[data-category="simulation"]').click();
      assert.ok(await page.locator(".project-card").count()>=2,"Simulation filter works");
    }
    console.log(viewport.name+" viewport:",JSON.stringify(measured));
    await page.close();
  }

  const warpPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const warpErrors = [];
  const warpPopups = [];
  await warpPage.addInitScript(() => { window.__ROCKET_WARP_TEST_MODE__ = true; });
  warpPage.on("pageerror", error => warpErrors.push(error.message));
  warpPage.on("popup", popup => warpPopups.push(popup));
  await warpPage.route("https://yixuanqi.github.io/PhotoGallery/projects.json**", route =>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(catalog)}));
  await warpPage.route("**/PhotoGallery/galaxy/**", route =>
    route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Galaxy route test</title><main id='galaxy-test-destination'>GALAXY_TEST_DESTINATION</main>"}));
  await warpPage.goto(origin,{waitUntil:"load",timeout:45000});
  const warpFrame = await waitForRocketFrame(warpPage);
  await warpPage.waitForTimeout(250);
  const rocketPoint = await warpFrame.evaluate(()=>window.__ROCKET_WARP_DEBUG__.getRocketScreenPoint());
  assert.ok(rocketPoint.x>0&&rocketPoint.x<1440&&rocketPoint.y>0&&rocketPoint.y<900,"3D rocket raycast point must be on screen");
  await warpFrame.locator("#cosmos-canvas").click({position:{x:rocketPoint.x,y:rocketPoint.y},force:true});
  await warpPage.waitForFunction(()=>document.body.classList.contains("rocket-launching"),null,{timeout:3000});
  await warpFrame.waitForFunction(()=>window.__ROCKET_WARP_STARTED__===true,null,{timeout:3000});
  const warpBox = await warpPage.locator("#rocket-warp-frame").boundingBox();
  assert.ok(warpBox && Math.abs(warpBox.y)<1 && Math.abs(warpBox.height-900)<1,
    "Real 3D warp must cover the header area, not leave a black stripe at the top");
  try {
    await warpPage.waitForURL(url=>new URL(url).pathname===galaxyPath,{timeout:25000});
  } catch (err) {
    const debug = await warpFrame.evaluate(() => ({
      stage:window.__ROCKET_WARP_STAGE__,
      started:window.__ROCKET_WARP_STARTED__,
      testMode:window.__ROCKET_WARP_TEST_MODE__,
      error:window.__ROCKET_WARP_ERROR__,
      handoff:document.body.classList.contains('handoff-pending')
    })).catch(e => ({frameError:String(e)}));
    console.error("Warp-stage timeout diagnostics:",JSON.stringify(debug));
    throw err;
  }
  assert.equal(new URL(warpPage.url()).origin,origin,"Warp navigation stays in the same tab and origin");
  assert.equal(warpPopups.length,0,"Warp must not open a new tab");
  assert.equal(await warpPage.locator("#galaxy-test-destination").count(),1,"3D warp reaches the galaxy route");
  const handoff=JSON.parse(await warpPage.evaluate(()=>sessionStorage.getItem("cosmos-to-galaxy-v3"))||"null");
  assert.equal(handoff?.version,3,"Same-tab galaxy arrival handshake v3 must be present");
  assert.equal(handoff?.origin,origin,"Arrival handshake must be scoped to the source origin");
  assert.ok(Number.isFinite(handoff?.startedAt)&&Date.now()-handoff.startedAt<45000,"Arrival handshake must be fresh");
  assert.equal(handoff?.durationMs,2800,"Portal continuation duration must be shared across pages");
  console.log("Projected 3D portal handoff:",JSON.stringify(handoff.portal));
  assert.ok(Number.isFinite(handoff?.portal?.x)&&handoff.portal.x>=0.08&&handoff.portal.x<=0.92,"Projected portal X must be normalized and on screen");
  assert.ok(Number.isFinite(handoff?.portal?.y)&&handoff.portal.y>=0.08&&handoff.portal.y<=0.92,"Projected portal Y must be normalized and on screen");
  assert.deepEqual(warpErrors,[],"Warp page must not throw browser errors");
  await warpPage.close();
  console.log("PASS: reference 3D rocket raycast, GLSL black hole, five-stage warp, same-tab galaxy handoff, and catalog regression.");
} finally {
  if(browser) await browser.close();
  server.kill("SIGTERM");
}
