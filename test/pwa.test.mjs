import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DASHBOARD_ASSETS } from "../scripts/dashboard-assets.mjs";

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("publishes an Android-installable web app manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

  assert.equal(manifest.start_url, "./index.html");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#0e110f");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
});

test("ships correctly sized raster icons", async () => {
  for (const [file, size] of [["icon-180.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512]]) {
    const image = await readFile(new URL(`../public/${file}`, import.meta.url));
    assert.deepEqual(pngDimensions(image), { width: size, height: size }, file);
  }
});

test("scopes offline caching to the static dashboard shell", async () => {
  const [html, worker] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /id="pwaInstallButton"/);
  assert.match(worker, /requestUrl\.pathname\.includes\("\/api\/"\)/);
  assert.doesNotMatch(worker.match(/const SHELL_ASSETS = \[([\s\S]*?)\]/)?.[1] ?? "", /api\/usage|api\/capabilities/);
  for (const asset of ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
    assert.ok(DASHBOARD_ASSETS.includes(asset), `${asset} must be part of the deterministic bundle`);
  }
});
