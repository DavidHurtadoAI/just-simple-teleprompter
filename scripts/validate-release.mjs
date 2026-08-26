import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const rootManifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const packagedManifest = JSON.parse(
  await readFile(path.join(root, "dist", "manifest.json"), "utf8")
);
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const versions = JSON.parse(await readFile(path.join(root, "versions.json"), "utf8"));

for (const file of ["README.md", "LICENSE", "manifest.json"]) {
  const info = await stat(path.join(root, file));
  if (!info.isFile() || info.size === 0) {
    throw new Error(`Missing required repository file: ${file}`);
  }
}

if (rootManifest.id !== "just-simple-teleprompter") {
  throw new Error("Unexpected plugin id");
}

if (rootManifest.id.includes("obsidian")) {
  throw new Error("The plugin id must not contain 'obsidian'");
}

if (!/^\d+\.\d+\.\d+$/.test(rootManifest.version)) {
  throw new Error("The manifest version must use exact x.y.z semantic versioning");
}

if (packageJson.version !== rootManifest.version) {
  throw new Error("package.json and manifest.json versions do not match");
}

if (versions[rootManifest.version] !== rootManifest.minAppVersion) {
  throw new Error("versions.json does not map this release to minAppVersion");
}

if (JSON.stringify(packagedManifest) !== JSON.stringify(rootManifest)) {
  throw new Error("The packaged manifest does not match the repository manifest");
}

if (rootManifest.isDesktopOnly !== false) {
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

console.log(
  `Release ${rootManifest.version} has the required repository files and mobile-safe assets`
);
