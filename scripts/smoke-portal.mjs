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
    page.on("pageerror", error => errors.push(error.message));
    page.on("popup", popup => popups.push(popup));
    await page.route("https://yixuanqi.github.io/PhotoGallery/projects.json**", route =>
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(catalog)}));
    await page.route("**/PhotoGallery/galaxy/**", route =>
      route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Galaxy route test</title><main id='galaxy-test-destination'>GALAXY_TEST_DESTINATION</main>"}));
    await page.goto(origin,{waitUntil:"load",timeout:45000});
    await page.waitForFunction(()=>window.__COSMOS_READY__===true||Boolean(window.__COSMOS_ERROR__),null,{timeout:30000});
    await page.waitForFunction(()=>document.querySelectorAll(".project-card").length===12,null,{timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(600);
    const status=await page.evaluate(()=>({ready:window.__COSMOS_READY__===true,error:window.__COSMOS_ERROR__||""}));
    assert.equal(status.ready,true,viewport.name+" V5 WebGL engine failed: "+status.error);
    assert.equal(await page.locator("#warp-trigger-btn").count(),1,"Exactly one portal CTA");
    assert.equal((await page.locator("#warp-trigger-btn").innerText()).trim(),"星海漫游","CTA label stays minimal");
    assert.equal(await page.locator(".hero-copy,.eyebrow,.hero-description,.hero-footnote,.hero-bottom-mark,.hero-actions").count(),0,"Hero copy and secondary actions must be removed");
    assert.equal(await page.locator(".header-portal").count(),0,"Duplicate header portal must be absent");
    const measured=await page.evaluate(()=>{
      const hero=document.querySelector(".hero").getBoundingClientRect();
      const button=document.getElementById("warp-trigger-btn").getBoundingClientRect();
      const canvas=document.getElementById("cosmos-canvas");
      const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
      return {heroHeight:hero.height,buttonLeft:button.left,buttonRight:button.right,buttonTop:button.top,buttonBottom:button.bottom,canvasWidth:canvas.width,canvasHeight:canvas.height,webglContext:Boolean(gl),hasHorizontalOverflow:document.documentElement.scrollWidth>innerWidth+2};
    });
    assert.equal(measured.hasHorizontalOverflow,false,viewport.name+" horizontal overflow");
    assert.ok(measured.buttonLeft>=0&&measured.buttonRight<=viewport.width+1,viewport.name+" CTA outside viewport");
    assert.ok(measured.canvasWidth>0&&measured.canvasHeight>0&&measured.webglContext,viewport.name+" WebGL canvas inactive");
    assert.deepEqual(errors,[],viewport.name+" uncaught browser errors");
    await page.screenshot({path:resolve("screenshots",viewport.name+".png")});
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
  warpPage.on("pageerror", error => warpErrors.push(error.message));
  warpPage.on("popup", popup => warpPopups.push(popup));
  await warpPage.addInitScript(() => { window.__COSMOS_TEST_MODE__ = true; });
  await warpPage.route("https://yixuanqi.github.io/PhotoGallery/projects.json**", route =>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(catalog)}));
  await warpPage.route("**/PhotoGallery/galaxy/**", route =>
    route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Galaxy route test</title><main id='galaxy-test-destination'>GALAXY_TEST_DESTINATION</main>"}));
  await warpPage.goto(origin,{waitUntil:"load",timeout:45000});
  await warpPage.waitForFunction(()=>window.__COSMOS_READY__===true||Boolean(window.__COSMOS_ERROR__),null,{timeout:30000});
  const warpEngineStatus=await warpPage.evaluate(()=>({ready:window.__COSMOS_READY__===true,error:window.__COSMOS_ERROR__||""}));
  assert.equal(warpEngineStatus.ready,true,"Fast warp test WebGL engine failed: "+warpEngineStatus.error);
  await warpPage.locator("#warp-trigger-btn").click({force:true});
  await warpPage.waitForFunction(()=>window.__COSMOS_WARP_STARTED__===true,null,{timeout:2000});
  await warpPage.waitForURL(url=>new URL(url).pathname===galaxyPath,{timeout:20000});
  assert.equal(new URL(warpPage.url()).origin,origin,"Warp navigation stays in the same tab and origin");
  assert.equal(warpPopups.length,0,"Warp must not open a new tab");
  assert.equal(await warpPage.locator("#galaxy-test-destination").count(),1,"V5 warp reaches the galaxy route");
  assert.deepEqual(warpErrors,[],"Warp page must not throw browser errors");
  await warpPage.close();
  console.log("PASS: V5 WebGL scene, minimal CTA, same-tab warp navigation, and catalog regression.");
} finally {
  if(browser) await browser.close();
  server.kill("SIGTERM");
}
