import path from "node:path";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { distManifestPath, fail, repoRoot } from "./manifest-lib.mjs";

const schemaPath = path.join(repoRoot, "schemas", "mascots.schema.json");
const [schema, manifest] = await Promise.all([
  readFile(schemaPath, "utf8").then(JSON.parse),
  readFile(distManifestPath, "utf8").then(JSON.parse)
]);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true
});
addFormats(ajv);

const validate = ajv.compile(schema);
if (!validate(manifest)) {
  const errors = ajv.errorsText(validate.errors, { separator: "\n" });
  fail(`dist/mascots.json does not match schemas/mascots.schema.json:\n${errors}`);
}

console.log("Validated dist/mascots.json against schemas/mascots.schema.json.");
