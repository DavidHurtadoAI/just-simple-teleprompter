import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "dist", "manifest.json"), "utf8"));

if (manifest.id !== "just-simple-teleprompter") {
  throw new Error("Unexpected plugin id");
}

if (manifest.isDesktopOnly !== false) {
  throw new Error("The release must support mobile devices");
}

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  const info = await stat(path.join(root, "dist", file));
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Invalid release asset: ${file}`);
  }
}

const bundle = await readFile(path.join(root, "dist", "main.js"), "utf8");
for (const forbidden of ["require(\"fs\")", "require(\"path\")", "require(\"electron\")"]) {
  if (bundle.includes(forbidden)) {
    throw new Error(`Desktop-only runtime dependency found: ${forbidden}`);
  }
}

console.log("Release assets are valid and mobile-safe");

