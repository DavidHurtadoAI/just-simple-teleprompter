import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const vaultArgument = process.argv[2];
if (!vaultArgument) {
  throw new Error("Usage: node scripts/install-test.mjs <vault-path>");
}

const root = process.cwd();
const vault = path.resolve(root, vaultArgument);
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const destination = path.join(vault, ".obsidian", "plugins", manifest.id);

await mkdir(destination, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(path.join(root, "dist", file), path.join(destination, file));
}

console.log(`Installed ${manifest.name} in ${destination}`);

