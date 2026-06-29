import { existsSync } from "node:fs";
import path from "node:path";
import { fail, loadMascotMetadata, metadataFileByRole } from "./manifest-lib.mjs";

const mascots = await loadMascotMetadata();
const camelCaseAssetPattern = /^[a-z][A-Za-z0-9]*\.(?:riv|rev)$/;

for (const mascot of mascots) {
  const runtime = metadataFileByRole(mascot, "runtime");
  const source = metadataFileByRole(mascot, "source");
  if (!runtime.path.endsWith(".riv")) fail(`${mascot.folder} runtime file must end in .riv`);
  if (!source.path.endsWith(".rev")) fail(`${mascot.folder} source file must end in .rev`);
  if (!camelCaseAssetPattern.test(path.basename(runtime.path))) {
    fail(`${mascot.folder} runtime file must use lower camelCase`);
  }
  if (!camelCaseAssetPattern.test(path.basename(source.path))) {
    fail(`${mascot.folder} source file must use lower camelCase`);
  }
  if (path.basename(runtime.path, ".riv") !== path.basename(source.path, ".rev")) {
    fail(`${mascot.folder} runtime and source files must share the same lower camelCase stem`);
  }

  const runtimePath = path.join(mascot.folderPath, runtime.path);
  const sourcePath = path.join(mascot.folderPath, source.path);
  if (!existsSync(runtimePath)) fail(`${mascot.folder} missing runtime file ${runtime.path}`);
  if (!existsSync(sourcePath)) fail(`${mascot.folder} missing source file ${source.path}`);
}

console.log(`Validated .riv/.rev pairs for ${mascots.length} mascot(s).`);
