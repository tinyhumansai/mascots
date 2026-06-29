import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const mascotsDir = path.join(repoRoot, "mascots");
const distDir = path.join(repoRoot, "dist");
const manifestPath = path.join(distDir, "mascots.json");
const checkOnly = process.argv.includes("--check");

const REPOSITORY =
  process.env.GITHUB_REPOSITORY || process.env.MASCOTS_REPOSITORY || "tinyhumansai/mascots";
const BRANCH =
  process.env.GITHUB_REF_NAME || process.env.MASCOTS_BRANCH || "main";
const COMMIT =
  process.env.GITHUB_SHA || process.env.MASCOTS_COMMIT || "local";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const camelCaseAssetPattern = /^[a-z][A-Za-z0-9]*\.(?:riv|rev)$/;
const allowedExtensions = new Set([".riv", ".rev", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const roleExtensions = {
  runtime: new Set([".riv"]),
  source: new Set([".rev"]),
  thumbnail: new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]),
  preview: new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])
};

function fail(message) {
  throw new Error(message);
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortKeys(item)])
    );
  }
  return value;
}

function rawUrl(relativePath) {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${relativePath
    .split(path.sep)
    .map(encodeURIComponent)
    .join("/")}`;
}

async function fileDigest(absolutePath) {
  const data = await readFile(absolutePath);
  return createHash("sha256").update(data).digest("hex");
}

async function loadMascot(folderName) {
  if (!slugPattern.test(folderName)) {
    fail(`Mascot folder '${folderName}' must be a lowercase kebab-case slug.`);
  }

  const folderPath = path.join(mascotsDir, folderName);
  const metadataPath = path.join(folderPath, "mascot.json");
  if (!existsSync(metadataPath)) {
    fail(`Mascot '${folderName}' is missing mascot.json.`);
  }

  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (metadata.id !== folderName) {
    fail(`Mascot '${folderName}' metadata id must match folder name.`);
  }
  if (!slugPattern.test(metadata.id)) {
    fail(`Mascot '${folderName}' id must be lowercase kebab-case.`);
  }
  if (!metadata.name || typeof metadata.name !== "string") {
    fail(`Mascot '${folderName}' must define a non-empty name.`);
  }
  if (!["ready", "draft"].includes(metadata.status)) {
    fail(`Mascot '${folderName}' status must be either 'ready' or 'draft'.`);
  }
  if (!Array.isArray(metadata.tags)) {
    fail(`Mascot '${folderName}' tags must be an array.`);
  }
  validateStateEngine(folderName, metadata.stateEngine);
  if (!Array.isArray(metadata.files) || metadata.files.length === 0) {
    fail(`Mascot '${folderName}' must list at least one file.`);
  }

  const files = [];
  for (const file of metadata.files) {
    if (!file || typeof file !== "object") {
      fail(`Mascot '${folderName}' file entries must be objects.`);
    }
    const role = file.role;
    const filePath = file.path;
    if (!roleExtensions[role]) {
      fail(`Mascot '${folderName}' file '${filePath}' has unsupported role '${role}'.`);
    }
    if (!filePath || typeof filePath !== "string" || path.isAbsolute(filePath) || filePath.includes("..")) {
      fail(`Mascot '${folderName}' file paths must be relative paths inside the mascot folder.`);
    }

    const extension = path.extname(filePath).toLowerCase();
    if (!allowedExtensions.has(extension) || !roleExtensions[role].has(extension)) {
      fail(`Mascot '${folderName}' file '${filePath}' extension does not match role '${role}'.`);
    }
    if ((extension === ".riv" || extension === ".rev") && !camelCaseAssetPattern.test(path.basename(filePath))) {
      fail(`Mascot '${folderName}' Rive asset '${filePath}' must use lower camelCase.`);
    }

    const absolutePath = path.join(folderPath, filePath);
    if (!existsSync(absolutePath)) {
      fail(`Mascot '${folderName}' references missing file '${filePath}'.`);
    }

    const stats = await stat(absolutePath);
    if (!stats.isFile()) {
      fail(`Mascot '${folderName}' references non-file path '${filePath}'.`);
    }

    const relativePath = path.relative(repoRoot, absolutePath);
    files.push({
      role,
      path: relativePath.split(path.sep).join("/"),
      url: rawUrl(relativePath),
      sha256: await fileDigest(absolutePath),
      bytes: stats.size
    });
  }

  if (!files.some((file) => file.role === "runtime")) {
    fail(`Mascot '${folderName}' must include at least one runtime .riv file.`);
  }
  if (!files.some((file) => file.role === "source")) {
    fail(`Mascot '${folderName}' must include at least one source .rev file.`);
  }

  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description || "",
    status: metadata.status,
    tags: [...new Set(metadata.tags)].sort((a, b) => a.localeCompare(b)),
    stateEngine: metadata.stateEngine,
    files: files.sort((a, b) => `${a.role}:${a.path}`.localeCompare(`${b.role}:${b.path}`))
  };
}

function validateStateEngine(folderName, stateEngine) {
  if (!stateEngine || typeof stateEngine !== "object") {
    fail(`Mascot '${folderName}' must define stateEngine.`);
  }
  if (!Array.isArray(stateEngine.visemeCodes) || stateEngine.visemeCodes.length === 0) {
    fail(`Mascot '${folderName}' stateEngine.visemeCodes must be a non-empty array.`);
  }
  if (!stateEngine.states || typeof stateEngine.states !== "object") {
    fail(`Mascot '${folderName}' stateEngine.states must be an object.`);
  }
  if (!stateEngine.states.idle || !stateEngine.states.thinking) {
    fail(`Mascot '${folderName}' stateEngine.states must define idle and thinking.`);
  }
  if (!Array.isArray(stateEngine.idlePoseCycle) || stateEngine.idlePoseCycle.length === 0) {
    fail(`Mascot '${folderName}' stateEngine.idlePoseCycle must be a non-empty array.`);
  }
  if (stateEngine.channels !== undefined) {
    if (!Array.isArray(stateEngine.channels)) {
      fail(`Mascot '${folderName}' stateEngine.channels must be an array when present.`);
    }
    const seenKeys = new Set();
    for (const channel of stateEngine.channels) {
      if (!channel || typeof channel !== "object") {
        fail(`Mascot '${folderName}' stateEngine.channels entries must be objects.`);
      }
      if (!channel.key || typeof channel.key !== "string") {
        fail(`Mascot '${folderName}' stateEngine.channels entries must define a string 'key'.`);
      }
      if (seenKeys.has(channel.key)) {
        fail(`Mascot '${folderName}' stateEngine.channels has duplicate key '${channel.key}'.`);
      }
      seenKeys.add(channel.key);
      if (!Array.isArray(channel.values) || channel.values.length === 0) {
        fail(`Mascot '${folderName}' stateEngine.channels '${channel.key}' must list at least one value.`);
      }
      if (channel.default !== undefined && !channel.values.includes(channel.default)) {
        fail(`Mascot '${folderName}' stateEngine.channels '${channel.key}' default must be one of its values.`);
      }
    }
  }
}

async function main() {
  const currentManifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, "utf8"))
    : null;
  const entries = existsSync(mascotsDir) ? await readdir(mascotsDir, { withFileTypes: true }) : [];
  const folderNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const mascots = [];
  for (const folderName of folderNames) {
    mascots.push(await loadMascot(folderName));
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: checkOnly && currentManifest?.generatedAt ? currentManifest.generatedAt : new Date().toISOString(),
    source:
      checkOnly && currentManifest?.source
        ? currentManifest.source
        : {
            repository: REPOSITORY,
            branch: BRANCH,
            commit: COMMIT
          },
    mascots
  };

  const json = `${JSON.stringify(sortKeys(manifest), null, 2)}\n`;

  if (checkOnly) {
    const current = currentManifest ? `${JSON.stringify(sortKeys(currentManifest), null, 2)}\n` : "";
    if (current !== json) {
      fail("dist/mascots.json is out of date. Run `npm run build`.");
    }
    return;
  }

  await mkdir(distDir, { recursive: true });
  await writeFile(manifestPath, json);
  console.log(`Wrote ${path.relative(repoRoot, manifestPath)} with ${mascots.length} mascot(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
