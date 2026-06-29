import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail, loadMascotMetadata, metadataFileByRole, requiredContract } from "./manifest-lib.mjs";

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

  for (const token of [
    requiredContract.stateMachine,
    requiredContract.viewModel,
    ...requiredContract.inputs,
    ...requiredContract.enums
  ]) {
    if (!haystack.includes(token)) missing.push(token);
  }

  const contract = mascot.metadata.contract ?? {};
  if (contract.stateMachine !== requiredContract.stateMachine) missing.push("metadata.contract.stateMachine");
  if (contract.viewModel !== requiredContract.viewModel) missing.push("metadata.contract.viewModel");
  for (const input of requiredContract.inputs) {
    if (!contract.inputs?.[input]) missing.push(`metadata.contract.inputs.${input}`);
  }

  if (missing.length > 0) {
    fail(`${mascot.folder} does not expose the OpenHuman Rive contract: ${missing.join(", ")}`);
  }

  checked += 1;
}

console.log(
  `Validated OpenHuman Rive contract for ${checked} mascot(s).${skipped ? ` Skipped ${skipped} draft mascot(s).` : ""}`
);
