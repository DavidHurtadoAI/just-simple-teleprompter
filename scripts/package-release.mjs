import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(path.join(root, file), path.join(dist, file));
}

console.log("Packaged release assets in dist/");
