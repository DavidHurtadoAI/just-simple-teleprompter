import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["dist/**", "main.js", "coverage/**"]
  },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*", "esbuild.config.*", "scripts/*.mjs"]
        }
      }
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Just Simple Teleprompter", "Markdown"]
        }
      ]
    }
  },
  {
    files: ["*.config.mjs", "scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
      "no-undef": "off",
      "obsidianmd/hardcoded-config-path": "off",
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off"
    }
  }
]);
