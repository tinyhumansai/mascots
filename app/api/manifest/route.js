import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifestPath = path.join(process.cwd(), "dist", "mascots.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return Response.json(manifest);
}
