import esbuild from "esbuild";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const production = process.argv.includes("production");
const watch = process.argv.includes("--watch");
const projectDirectory = path.dirname(fileURLToPath(import.meta.url));

const context = await esbuild.context({
  absWorkingDir: projectDirectory,
  entryPoints: [path.join(projectDirectory, "main.ts")],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view", "@codemirror/language", "@codemirror/search", "@codemirror/autocomplete", "@codemirror/commands", "@codemirror/lint", "@codemirror/collab", "@codemirror/lang-markdown"],
  format: "cjs",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  minify: production,
  outfile: path.join(projectDirectory, "main.js")
});

if (watch) {
  await context.watch();
  console.log("Watching Just Simple Teleprompter...");
} else {
  await context.rebuild();
  await context.dispose();
}
