import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail, loadMascotMetadata, metadataFileByRole, requiredStateEngine } from "./manifest-lib.mjs";

const checkAll = process.argv.includes("--all");
const mascots = await loadMascotMetadata();
let checked = 0;
let skipped = 0;

function printableStrings(buffer) {
  const text = buffer.toString("latin1");
  return Array.from(text.matchAll(/[ -~]{2,}/g), (match) => match[0].replace(/\f/g, ""));
}

for (const mascot of mascots) {
  if (mascot.metadata.status !== "ready" && !checkAll) {
    skipped += 1;
    continue;
  }

  const runtime = metadataFileByRole(mascot, "runtime");
  const runtimePath = path.join(mascot.folderPath, runtime.path);
  const strings = printableStrings(await readFile(runtimePath));
  const haystack = strings.join("\n");
  const missing = [];

  const engine = mascot.metadata.stateEngine ?? {};
  const engineStates = engine.states ?? {};
  const tokens = [
    requiredStateEngine.visemeInput,
    requiredStateEngine.visemeEnum,
    requiredStateEngine.poseEnum,
    ...requiredStateEngine.visemes,
    engineStates.idle,
    engineStates.thinking,
    ...(engine.idlePoseCycle ?? [])
  ].filter(Boolean);

  for (const token of tokens) {
    if (!haystack.includes(token)) missing.push(token);
  }

  if (!Array.isArray(engine.visemeCodes)) {
    missing.push("metadata.stateEngine.visemeCodes");
  } else {
    for (const code of requiredStateEngine.visemes) {
      if (!engine.visemeCodes.includes(code)) missing.push(`metadata.stateEngine.visemeCodes.${code}`);
    }
  }

  if (missing.length > 0) {
    fail(`${mascot.folder} does not expose the OpenHuman Rive state engine: ${missing.join(", ")}`);
  }

  checked += 1;
}

console.log(
  `Validated OpenHuman Rive state engine for ${checked} mascot(s).${skipped ? ` Skipped ${skipped} draft mascot(s).` : ""}`
);
