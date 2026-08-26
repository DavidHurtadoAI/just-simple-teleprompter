import { Menu, Notice, Plugin, TAbstractFile, TFile } from "obsidian";
import { JustSimpleTeleprompterSettingTab } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings } from "./types";
import type { TeleprompterSettings } from "./types";
import { TELEPROMPTER_VIEW_TYPE, TeleprompterView } from "./view";

export default class JustSimpleTeleprompterPlugin extends Plugin {
  settings: TeleprompterSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    this.settings = mergeSettings((await this.loadData()) as Partial<TeleprompterSettings> | null);

    this.registerView(
      TELEPROMPTER_VIEW_TYPE,
      (leaf) => new TeleprompterView(leaf, this)
    );

    this.addSettingTab(new JustSimpleTeleprompterSettingTab(this.app, this));

    this.addRibbonIcon("presentation", "Open current note in teleprompter", () => {
      void this.openActiveFile();
    });

    this.addCommand({
      id: "open-current-note",
      name: "Open current note",
      callback: () => void this.openActiveFile()
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => this.addFileMenuItem(menu, file))
    );
  }

  async openFile(file: TFile): Promise<TeleprompterView> {
    if (!isMarkdownFile(file)) {
      throw new Error("Just Simple Teleprompter supports Markdown notes only.");
    }

    const existing = this.app.workspace.getLeavesOfType(TELEPROMPTER_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: TELEPROMPTER_VIEW_TYPE,
      state: { file: file.path },
      active: true
    });
    await this.app.workspace.revealLeaf(leaf);

    if (!(leaf.view instanceof TeleprompterView)) {
      throw new Error("Obsidian did not create the teleprompter view.");
    }
    return leaf.view;
  }

  async updateSettings(patch: Partial<TeleprompterSettings>): Promise<void> {
    this.settings = mergeSettings({ ...this.settings, ...patch });
    await this.saveData(this.settings);

    for (const leaf of this.app.workspace.getLeavesOfType(TELEPROMPTER_VIEW_TYPE)) {
      if (leaf.view instanceof TeleprompterView) {
        leaf.view.applySettings();
      }
    }
  }

  private async openActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!isMarkdownFile(file)) {
      new Notice("Open a Markdown note first.");
      return;
    }
    await this.openFile(file);
  }

  private addFileMenuItem(menu: Menu, file: TAbstractFile): void {
    if (!isMarkdownFile(file)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle("Open in Just Simple Teleprompter")
        .setIcon("presentation")
        .onClick(() => void this.openFile(file));
    });
  }
}

function isMarkdownFile(file: TAbstractFile | null): file is TFile {
  return file instanceof TFile && file.extension.toLowerCase() === "md";
}
