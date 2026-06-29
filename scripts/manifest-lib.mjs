import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const mascotsDir = path.join(repoRoot, "mascots");
export const distManifestPath = path.join(repoRoot, "dist", "mascots.json");

export const requiredContract = {
  stateMachine: "MascotSM",
  viewModel: "ViewModel1",
  inputs: ["pose", "mouthVisemeCode", "primaryColor", "secondaryColor"],
  enums: ["poses", "visme_codes"],
  poses: [
    "idle",
    "thinking",
    "celebration",
    "bookreading",
    "coffeedrink",
    "writing",
    "bobbateadrink",
    "recording",
    "hand_wave",
    "dancing"
  ],
  visemes: ["sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR", "aa", "E", "ih", "oh", "ou"]
};

export function fail(message) {
  throw new Error(message);
}

export async function loadMascotMetadata() {
  if (!existsSync(mascotsDir)) return [];
  const entries = await readdir(mascotsDir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const mascots = [];
  for (const folder of folders) {
    const metadataPath = path.join(mascotsDir, folder, "mascot.json");
    if (!existsSync(metadataPath)) fail(`${folder} is missing mascot.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    mascots.push({ folder, folderPath: path.dirname(metadataPath), metadata });
  }
  return mascots;
}

export function metadataFileByRole(mascot, role) {
  const matches = mascot.metadata.files?.filter((file) => file.role === role) ?? [];
  if (matches.length !== 1) {
    fail(`${mascot.folder} must declare exactly one '${role}' file.`);
  }
  return matches[0];
}

