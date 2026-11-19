import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const app = await readFile(resolve(root, "assets/app.js"), "utf8");

assert.match(html, /\.\/assets\/styles\.css/, "index.html must load the stylesheet");
assert.match(html, /\.\/assets\/cosmos-home\.css/, "index.html must load the V5 cosmic visual layer");
assert.match(html, /\.\/assets\/app\.js/, "index.html must load the application script");
assert.match(html, /\.\/assets\/cosmos-home\.js/, "index.html must load the V5 Three.js engine");
assert.match(html, /"three":\s*"https:\/\/unpkg\.com\/three@0\.168\.0\/build\/three\.module\.js"/, "V5 engine must pin its Three.js version");
assert.match(html, /id="warp-trigger-btn"[\s\S]*?星海漫游/, "homepage must have one star-sea CTA");
assert.doesNotMatch(html, /header-portal|hero-copy|hero-description|hero-footnote|hero-bottom-mark/, "homepage hero must not show promotional copy or duplicate portal buttons");
assert.doesNotMatch(html, /href="https:\/\/yixuanqi\.github\.io\/PhotoGallery\/galaxy\/"[^>]*target="_blank"/, "star-sea destination must stay in the current tab");
const cosmos = await readFile(resolve(root, "assets/cosmos-home.js"), "utf8");
assert.match(cosmos, /COSMOS_BACKDROP_FRAG/, "homepage must use the V5 GLSL nebula backdrop");
assert.match(cosmos, /CAPSULE_STAR_VERT/, "homepage must use the V5 analytical capsule star shader");
assert.match(cosmos, /STAGE_DUR[\s\S]*?CHARGE:\s*1\.5[\s\S]*?BREAKTHROUGH:\s*1\.3[\s\S]*?CRUISE:\s*4\.6[\s\S]*?DECEL:\s*3\.1/, "V5 warp choreography must remain intact");
assert.match(cosmos, /window\.location\.assign\('\/PhotoGallery\/galaxy\/'\)/, "warp must navigate to the galaxy route in the same tab");
await access(resolve(root, "references/galaxy-warp-v5.html"));
await access(resolve(root, "VISUAL_BASELINE.md"));
assert.match(app, /https:\/\/yixuanqi\.github\.io\/PhotoGallery\/projects\.json/, "portal must consume the PhotoGallery catalog");
assert.doesNotMatch(app, /const\s+projects\s*=\s*\[/, "project records must not be duplicated in portal code");

const localReferences = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map(match => match[1]);
for (const reference of localReferences) {
  const filePath = resolve(root, reference.replace(/^\.\//, ""));
  await access(filePath);
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
} else {
  console.log("Remote catalog check skipped by SKIP_REMOTE_CATALOG=1.");
}

console.log("Portal structure and local asset references validated.");
