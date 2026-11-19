import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const port = 8765;
const origin = "http://127.0.0.1:" + port;
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
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const catalogResponse = await fetch("https://yixuanqi.github.io/PhotoGallery/projects.json");
  assert.equal(catalogResponse.status, 200, "Published catalog must be reachable");
  const catalog = await catalogResponse.json();
  assert.equal(catalog.projects.length, 12, "Baseline catalog contains 12 projects");

  await mkdir(resolve("screenshots"), { recursive: true });
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("https://yixuanqi.github.io/PhotoGallery/projects.json**", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalog)
      });
    });
    await page.goto(origin, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelectorAll(".project-card").length === 12, null, { timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    assert.equal(await page.locator(".hero-art").count(), 0, "Old static planet illustration must be absent");
    assert.equal(await page.locator(".hero-atmosphere").count(), 1, "Cosmic atmosphere must exist");
    const measured = await page.evaluate(() => {
      const hero = document.querySelector(".hero").getBoundingClientRect();
      const title = document.getElementById("hero-title").getBoundingClientRect();
      const canvas = document.getElementById("starfield");
      const ctx = canvas.getContext("2d");
      const sampled = ctx.getImageData(0, 0, Math.min(canvas.width, 480), Math.min(canvas.height, 480)).data;
      let painted = 0;
      for (let i = 3; i < sampled.length; i += 4) if (sampled[i] > 0) painted++;
      return {
        heroHeight: hero.height,
        heroTop: hero.top,
        titleLeft: title.left,
        titleRight: title.right,
        titleBottom: title.bottom,
        heroBottom: hero.bottom,
        canvasWidth: canvas.width,
        paintedPixels: painted,
        hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2
      };
    });
    assert.equal(measured.hasHorizontalOverflow, false, viewport.name + " horizontal overflow");
    assert.ok(measured.titleLeft >= 0 && measured.titleRight <= viewport.width + 1, viewport.name + " title outside viewport");
    assert.ok(measured.titleBottom < measured.heroBottom + 1, viewport.name + " title outside hero");
    assert.ok(measured.paintedPixels > 100, viewport.name + " cosmic canvas appears empty");
    assert.deepEqual(errors, [], viewport.name + " uncaught browser errors");
    await page.screenshot({ path: resolve("screenshots", viewport.name + ".png") });
    if (viewport.name === "desktop") {
      const search = page.locator("#project-search");
      await search.fill("引力透镜");
      assert.equal(await page.locator(".project-card").count(), 1, "Search filters by name");
      await search.fill("");
      await page.locator('button[data-category="simulation"]').click();
      assert.ok(await page.locator(".project-card").count() >= 2, "Simulation filter works");
    }
    console.log(viewport.name + " viewport:", JSON.stringify(measured));
    await page.close();
  }
  console.log("PASS: immersive hero and catalog regression on desktop/mobile");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
