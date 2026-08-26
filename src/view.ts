import {
  Component,
  FileView,
  MarkdownRenderer,
  Notice,
  TFile,
  WorkspaceLeaf,
  getFrontMatterInfo,
  setIcon
} from "obsidian";
import type JustSimpleTeleprompterPlugin from "./plugin";
import { resolveTeleprompterAction } from "./input-controller";
import { ScrollEngine } from "./scroll-engine";
import type { MotionState, ScrollDirection } from "./types";
import { WakeLockController } from "./wake-lock-controller";

export const TELEPROMPTER_VIEW_TYPE = "just-simple-teleprompter-view";
const CONTROLS_HIDE_DELAY_MS = 1800;
const SPEED_STEP = 4;

export class TeleprompterView extends FileView {
  private rootEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  private readerEl: HTMLElement | null = null;
  private noteTitleEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private speedEl: HTMLElement | null = null;
  private engine: ScrollEngine | null = null;
  private renderComponent: Component | null = null;
  private controlsTimer: number | null = null;
  private renderGeneration = 0;
  private isViewOpen = false;
  private readonly wakeLock = new WakeLockController();

  constructor(leaf: WorkspaceLeaf, private readonly plugin: JustSimpleTeleprompterPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return TELEPROMPTER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file ? `${this.file.basename} · Teleprompter` : "Just Simple Teleprompter";
  }

  getIcon(): string {
    return "presentation";
  }

  canAcceptExtension(extension: string): boolean {
    return extension.toLowerCase() === "md";
  }

  async onOpen(): Promise<void> {
    this.isViewOpen = true;
    this.buildInterface();
    this.registerDomEvent(window, "keydown", (event) => this.handleKeydown(event), true);
    this.registerDomEvent(document, "visibilitychange", () => {
      void this.wakeLock.handleVisibilityChange();
    });
    this.addAction("refresh-cw", "Reload note", () => void this.reload());
    await this.wakeLock.setEnabled(this.plugin.settings.keepAwake);

    if (this.file) {
      await this.renderFile(this.file);
    }
  }

  async onLoadFile(file: TFile): Promise<void> {
    if (this.isViewOpen) {
      await this.renderFile(file);
    }
  }

  async onUnloadFile(_file: TFile): Promise<void> {
    this.stopEngine();
    this.releaseRenderComponent();
    if (this.readerEl) {
      this.readerEl.empty();
    }
  }

  async onClose(): Promise<void> {
    this.isViewOpen = false;
    this.renderGeneration += 1;
    this.clearControlsTimer();
    this.stopEngine();
    this.releaseRenderComponent();
    await this.wakeLock.destroy();
    this.contentEl.empty();
  }

  applySettings(): void {
    const settings = this.plugin.settings;
    this.rootEl?.style.setProperty("--jst-font-size", `${settings.fontSize}px`);
    this.rootEl?.style.setProperty("--jst-line-height", settings.lineHeight.toString());
    this.readerEl?.toggleClass("is-mirrored", settings.mirrorHorizontally);
    this.engine?.setSpeed(settings.speed);
    this.updateSpeedLabel();
    void this.wakeLock.setEnabled(settings.keepAwake);
  }

  private buildInterface(): void {
    this.contentEl.empty();
    this.contentEl.addClass("jst-view-content");

    const root = this.contentEl.createDiv({ cls: "jst-root is-paused" });
    const scroll = root.createDiv({ cls: "jst-scroll", attr: { tabindex: "0" } });
    scroll.setAttribute("aria-label", "Teleprompter text");

    const reader = scroll.createDiv({ cls: "jst-reader markdown-rendered" });
    const cue = root.createDiv({ cls: "jst-cue", attr: { "aria-hidden": "true" } });
    cue.createDiv({ cls: "jst-cue-notch" });

    const chrome = root.createDiv({ cls: "jst-chrome" });
    const header = chrome.createDiv({ cls: "jst-header" });
    const headingText = header.createDiv({ cls: "jst-heading-text" });
    this.noteTitleEl = headingText.createDiv({ cls: "jst-title", text: "Teleprompter" });
    this.statusEl = headingText.createDiv({ cls: "jst-status", text: "Paused" });

    const controls = chrome.createDiv({ cls: "jst-controls" });
    const speedControls = controls.createDiv({ cls: "jst-speed-controls" });
    this.createIconButton(speedControls, "minus", "Slower", "jst-small-button", () => {
      void this.changeSpeed(-SPEED_STEP);
    });
    this.speedEl = speedControls.createDiv({ cls: "jst-speed", text: "36 px/s" });
    this.createIconButton(speedControls, "plus", "Faster", "jst-small-button", () => {
      void this.changeSpeed(SPEED_STEP);
    });

    const transport = controls.createDiv({ cls: "jst-transport" });
    this.createIconButton(transport, "arrow-up", "Reverse", "jst-transport-button", () => {
      this.engine?.start(-1);
    });
    this.playButton = this.createIconButton(
      transport,
      "play",
      "Resume",
      "jst-transport-button is-primary",
      () => this.engine?.toggle()
    );
    this.createIconButton(transport, "arrow-down", "Forward", "jst-transport-button", () => {
      this.engine?.start(1);
    });

    this.rootEl = root;
    this.scrollEl = scroll;
    this.readerEl = reader;

    this.registerDomEvent(root, "pointerdown", () => this.revealControls());
    this.registerDomEvent(root, "mousemove", () => this.revealControls());
    this.registerDomEvent(scroll, "scroll", () => {
      if (!this.engine?.isRunning) {
        this.revealControls();
      }
    });

    this.applySettings();
  }

  private async renderFile(file: TFile): Promise<void> {
    if (!this.readerEl || !this.scrollEl) {
      return;
    }

    const generation = ++this.renderGeneration;
    this.stopEngine();
    this.releaseRenderComponent();
    this.readerEl.empty();
    this.readerEl.createDiv({ cls: "jst-spacer jst-spacer-top" });
    const body = this.readerEl.createDiv({ cls: "jst-document" });
    body.setText("Loading…");
    this.noteTitleEl?.setText(file.basename);

    try {
      const raw = await this.app.vault.cachedRead(file);
      if (generation !== this.renderGeneration || file !== this.file) {
        return;
      }

      const frontmatter = getFrontMatterInfo(raw);
      const markdown = frontmatter.exists ? raw.slice(frontmatter.contentStart) : raw;
      const component = new Component();
      component.load();
      body.empty();

      if (markdown.trim().length === 0) {
        body.createEl("p", { cls: "jst-empty", text: "This note is empty." });
      } else {
        await MarkdownRenderer.render(this.app, markdown, body, file.path, component);
      }

      if (generation !== this.renderGeneration || file !== this.file) {
        component.unload();
        return;
      }

      this.renderComponent = component;
      this.readerEl.createDiv({ cls: "jst-spacer jst-spacer-bottom" });
      this.scrollEl.scrollTop = 0;
      this.engine = new ScrollEngine(
        this.scrollEl,
        this.plugin.settings.speed,
        {
          onMotionChange: (state, direction) => this.handleMotionChange(state, direction),
          onBoundary: (direction) => this.handleBoundary(direction)
        }
      );
      this.applySettings();
      this.handleMotionChange("paused", 1);
    } catch (error) {
      if (generation !== this.renderGeneration) {
        return;
      }
      body.empty();
      body.createEl("p", { cls: "jst-error", text: "Could not render this note." });
      console.error("Just Simple Teleprompter failed to render a note", error);
      new Notice("Just Simple Teleprompter could not render this note.");
    }
  }

  private async reload(): Promise<void> {
    if (this.file) {
      await this.renderFile(this.file);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (
      this.app.workspace.getActiveViewOfType(TeleprompterView) !== this ||
      document.querySelector(".modal-container") !== null
    ) {
      return;
    }

    const action = resolveTeleprompterAction(event, this.plugin.settings);
    if (action === null || this.engine === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    switch (action) {
      case "forward":
        this.engine.start(1);
        break;
      case "reverse":
        this.engine.start(-1);
        break;
      case "toggle":
        this.engine.toggle();
        break;
      case "pause":
        this.engine.pause();
        break;
    }
  }

  private handleMotionChange(state: MotionState, direction: ScrollDirection): void {
    this.rootEl?.toggleClass("is-paused", state === "paused");
    this.rootEl?.toggleClass("is-forward", state === "forward");
    this.rootEl?.toggleClass("is-reverse", state === "reverse");

    if (this.statusEl) {
      this.statusEl.setText(
        state === "forward" ? "Forward" : state === "reverse" ? "Reverse" : "Paused"
      );
    }

    if (this.playButton) {
      this.playButton.empty();
      const running = state !== "paused";
      setIcon(this.playButton, running ? "pause" : "play");
      this.playButton.setAttribute("aria-label", running ? "Pause" : "Resume");
      this.playButton.setAttribute("data-tooltip-position", "top");
      this.playButton.setAttribute("aria-pressed", running ? "true" : "false");
    }

    if (state === "paused") {
      this.showControls(true);
    } else {
      this.revealControls();
    }

    this.rootEl?.setAttribute("data-direction", direction === 1 ? "forward" : "reverse");
  }

  private handleBoundary(direction: ScrollDirection): void {
    if (this.statusEl) {
      this.statusEl.setText(direction === 1 ? "End · Paused" : "Start · Paused");
    }
    this.showControls(true);
  }

  private revealControls(): void {
    this.showControls(true);
    if (this.engine?.isRunning) {
      this.clearControlsTimer();
      this.controlsTimer = window.setTimeout(() => {
        this.showControls(false);
        this.controlsTimer = null;
      }, CONTROLS_HIDE_DELAY_MS);
    }
  }

  private showControls(visible: boolean): void {
    this.rootEl?.toggleClass("is-controls-hidden", !visible);
    if (visible || !this.engine?.isRunning) {
      this.clearControlsTimer();
    }
  }

  private clearControlsTimer(): void {
    if (this.controlsTimer !== null) {
      window.clearTimeout(this.controlsTimer);
      this.controlsTimer = null;
    }
  }

  private stopEngine(): void {
    this.engine?.destroy();
    this.engine = null;
    this.handleMotionChange("paused", 1);
  }

  private releaseRenderComponent(): void {
    this.renderComponent?.unload();
    this.renderComponent = null;
  }

  private async changeSpeed(delta: number): Promise<void> {
    const next = Math.min(160, Math.max(4, this.plugin.settings.speed + delta));
    await this.plugin.updateSettings({ speed: next });
    this.revealControls();
  }

  private updateSpeedLabel(): void {
    this.speedEl?.setText(`${Math.round(this.plugin.settings.speed)} px/s`);
  }

  private createIconButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    className: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: className,
      attr: {
        type: "button",
        "aria-label": label,
        "data-tooltip-position": "top"
      }
    });
    setIcon(button, icon);
    this.registerDomEvent(button, "click", (event) => {
      event.preventDefault();
      onClick();
    });
    return button;
  }
}
