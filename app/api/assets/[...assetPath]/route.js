import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const contentTypes = {
  ".riv": "application/octet-stream",
  ".rev": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

export async function GET(_request, context) {
  const params = await context.params;
  const assetPath = params.assetPath ?? [];
  const relativePath = assetPath.join("/");
  const root = path.resolve(process.cwd(), "mascots");
  const absolutePath = path.resolve(root, relativePath);

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    return new Response("Invalid asset path", { status: 400 });
  }

  const fileStat = await stat(absolutePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return new Response("Asset not found", { status: 404 });
  }

  const extension = path.extname(absolutePath).toLowerCase();
  const body = await readFile(absolutePath);
  return new Response(body, {
    headers: {
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "cache-control": "no-store"
    }
  });
}
