import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const app = await readFile(resolve(root, "assets/app.js"), "utf8");
const scene = await readFile(resolve(root, "assets/rocket-warp.html"), "utf8");
const baseline = await readFile(resolve(root, "VISUAL_BASELINE.md"), "utf8");

assert.match(html, /\.\/assets\/styles\.css/, "index.html must load the site stylesheet");
assert.match(html, /\.\/assets\/cosmos-home\.css/, "index.html must load the immersive hero stylesheet");
assert.match(html, /\.\/assets\/app\.js/, "index.html must load the project catalog application");
assert.match(html, /id="rocket-warp-frame"[\s\S]*?src="\.\/assets\/rocket-warp\.html"/, "homepage must embed the reference-based rocket scene");
assert.equal((html.match(/id="rocket-warp-frame"/g) || []).length, 1, "homepage must have exactly one rocket scene iframe");
assert.doesNotMatch(html, /assets\/cosmos-home\.js|id="cosmos-canvas"|blackhole-gate|rocket-ship/, "the old CSS/SVG portal implementation must not remain active in the parent page");
assert.doesNotMatch(html, /PhotoGallery\/galaxy\/[^"]*"[^>]*target="_blank"/, "star-sea navigation must stay in the current tab");

assert.match(scene, /"three":\s*"https:\/\/unpkg\.com\/three@0\.160\.0\/build\/three\.module\.js"/, "reference Three.js version must be pinned");
assert.match(scene, /function buildChibiRocket3D\(/, "scene must build the procedural 3D Q rocket");
assert.match(scene, /const LENSING_BLACKHOLE_FRAG/, "scene must use the GLSL gravitational-lensing black hole");
assert.match(scene, /const CAPSULE_STAR_VERT/, "scene must preserve the analytical star-stream shader");
assert.match(scene, /const STAGE_DUR[\s\S]*?ROCKET_DIVE:\s*2\.15\s*\*\s*timeScale[\s\S]*?SINGULARITY_CHARGE:\s*0\.75\s*\*\s*timeScale[\s\S]*?BREAKTHROUGH:\s*1\.25\s*\*\s*timeScale[\s\S]*?CRUISE:\s*4\.50\s*\*\s*timeScale[\s\S]*?ARRIVE_RETURN:\s*2\.85\s*\*\s*timeScale/, "five-stage reference choreography must be retained");
assert.match(scene, /topWindow\.location\.assign\('\/PhotoGallery\/galaxy\/'\)/, "the completed warp must navigate the top-level window in the same tab");
assert.match(scene, /cosmos-to-galaxy-v3/, "the synchronized galaxy arrival handshake v3 must be written");
assert.match(scene, /durationMs:\s*transitionDurationMs/, "the source must transfer the shared transition duration");
assert.match(scene, /portal:\s*\{\s*x:\s*portalX\s*\/\s*100,\s*y:\s*portalY\s*\/\s*100\s*\}/, "the source must transfer the projected 3D portal origin");
assert.match(scene, /cosmos-portal-ring 2800ms/, "the source portal ring must use the shared 2.8-second curve");
assert.match(scene, /state\.stage === 'HANDOFF'[\s\S]*portalMesh\.visible = true[\s\S]*rocket\.root\.visible = true/, "the final rocket and portal pose must survive beneath the handoff veil");
assert.match(scene, /window\.__ROCKET_WARP_READY__\s*=\s*true/, "scene must expose a ready marker for browser tests");
assert.match(scene, /window\.__ROCKET_WARP_DEBUG__/, "scene must expose the rocket raycast point for deterministic browser tests");
assert.match(baseline, /rocket-blackhole-warp-3d-q\.html/, "the uploaded HTML must be the primary visual baseline");
assert.match(baseline, /cosmos-to-galaxy-v3/, "the documented handoff protocol must be v3");
assert.doesNotMatch(baseline, /set a one-time `sessionStorage` token `cosmos-to-galaxy-v2`/, "the v2 handoff must no longer be documented as the production path");
await access(resolve(root, "references/rocket-blackhole-warp-3d-q.html"));

assert.match(app, /https:\/\/yixuanqi\.github\.io\/PhotoGallery\/projects\.json/, "portal must consume the canonical PhotoGallery catalog");
assert.doesNotMatch(app, /const\s+projects\s*=\s*\[/, "project records must not be duplicated in portal code");

const localReferences = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map(match => match[1]);
for (const reference of localReferences) {
  await access(resolve(root, reference.replace(/^\.\//, "")));
}

if (process.env.SKIP_REMOTE_CATALOG !== "1") {
  const catalogUrl = "https://yixuanqi.github.io/PhotoGallery/projects.json";
  const response = await fetch(catalogUrl, { headers: { accept: "application/json" } });
  assert.equal(response.status, 200, "published project catalog must be reachable");
  const catalog = await response.json();
  assert.ok(Array.isArray(catalog.projects) && catalog.projects.length > 0, "catalog must contain projects");

  const ids = new Set();
  const sortOrders = new Set();
  for (const project of catalog.projects) {
    for (const field of ["id", "name", "kind", "category", "status", "summary", "primaryUrl", "primaryAction", "repositoryUrl", "sortOrder"]) {
      assert.ok(project[field] !== undefined && project[field] !== null, project.id + " is missing " + field);
    }
    assert.ok(!ids.has(project.id), "project IDs must be unique: " + project.id);
    assert.ok(!sortOrders.has(project.sortOrder), "project sortOrder values must be unique: " + project.sortOrder);
    ids.add(project.id);
    sortOrders.add(project.sortOrder);
    assert.equal(new URL(project.primaryUrl).protocol, "https:", project.id + " primaryUrl must use HTTPS");
    assert.equal(new URL(project.repositoryUrl).protocol, "https:", project.id + " repositoryUrl must use HTTPS");
  }
  console.log("Remote project catalog: " + catalog.projects.length + " entries validated.");

  // Cross-repository integration contract: the published destination must
  // consume the same v3 transition as the live portal, not only a mocked route.
  const galaxyUrl = "https://yixuanqi.github.io/PhotoGallery/galaxy/";
  const galaxyResponse = await fetch(galaxyUrl, { headers: { accept: "text/html" } });
  assert.equal(galaxyResponse.status, 200, "published Galaxy destination must be reachable");
  const galaxy = await galaxyResponse.text();
  assert.match(galaxy, /cosmos-to-galaxy-v3/, "published Galaxy must consume the v3 handoff");
  assert.match(galaxy, /payload\.startedAt/, "published Galaxy must preserve the shared source clock");
  assert.match(galaxy, /payload\.durationMs/, "published Galaxy must preserve the shared transition duration");
  assert.match(galaxy, /portal\.x/, "published Galaxy must reuse the projected 3D portal X");
  assert.match(galaxy, /portal\.y/, "published Galaxy must reuse the projected 3D portal Y");
  assert.match(galaxy, /sessionStorage\.removeItem\(keyV3\)/, "arrival token must be consumed exactly once");
  assert.match(galaxy, /cosmos-arrival-ready/, "published Galaxy must implement the arrival reveal");
  console.log("Published Galaxy v3 arrival protocol validated.");
} else {
  console.log("Remote catalog check skipped by SKIP_REMOTE_CATALOG=1.");
}

console.log("Portal structure, reference-based 3D scene, and local asset references validated.");
