// Cesium ships static Workers/Assets/Widgets that must be served from a base
// URL. Copy them into public/cesium so the app can set CESIUM_BASE_URL=/cesium.
// Runs as an npm "prebuild" step (locally and inside the Docker build).
import { cp, mkdir, access } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

const parts = ["Workers", "Assets", "Widgets", "ThirdParty"];

try {
  await access(src);
} catch {
  console.error("[copy-cesium] cesium build not found at", src);
  process.exit(0); // don't hard-fail install ordering
}

await mkdir(dest, { recursive: true });
for (const p of parts) {
  await cp(join(src, p), join(dest, p), { recursive: true }).catch((e) =>
    console.warn("[copy-cesium] skip", p, e.message)
  );
}
console.log("[copy-cesium] Cesium static assets copied to public/cesium");
