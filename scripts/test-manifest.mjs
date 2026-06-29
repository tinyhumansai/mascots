import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { distManifestPath, fail } from "./manifest-lib.mjs";

if (!existsSync(distManifestPath)) {
  fail("dist/mascots.json is missing. Run `npm run build`.");
}

const manifest = JSON.parse(await readFile(distManifestPath, "utf8"));
if (manifest.schemaVersion !== 1) fail("manifest schemaVersion must be 1");
if (!Array.isArray(manifest.mascots)) fail("manifest mascots must be an array");

const ids = new Set();
for (const mascot of manifest.mascots) {
  if (ids.has(mascot.id)) fail(`duplicate mascot id '${mascot.id}'`);
  ids.add(mascot.id);
  if (!["ready", "draft"].includes(mascot.status)) fail(`${mascot.id} has invalid status`);
  if (!mascot.stateEngine?.states?.idle) fail(`${mascot.id} is missing stateEngine.states.idle`);
  if (!mascot.stateEngine?.states?.thinking) fail(`${mascot.id} is missing stateEngine.states.thinking`);
  if (!Array.isArray(mascot.stateEngine?.visemeCodes) || mascot.stateEngine.visemeCodes.length === 0) {
    fail(`${mascot.id} is missing stateEngine.visemeCodes`);
  }
  if (!Array.isArray(mascot.stateEngine?.idlePoseCycle) || mascot.stateEngine.idlePoseCycle.length === 0) {
    fail(`${mascot.id} is missing stateEngine.idlePoseCycle`);
  }
  if (!mascot.files?.some((file) => file.role === "runtime" && file.path.endsWith(".riv"))) {
    fail(`${mascot.id} is missing runtime .riv file`);
  }
  if (!mascot.files?.some((file) => file.role === "source" && file.path.endsWith(".rev"))) {
    fail(`${mascot.id} is missing source .rev file`);
  }
}

console.log(`Validated manifest with ${manifest.mascots.length} mascot(s).`);
