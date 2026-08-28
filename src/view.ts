import {
  Component,
  FileView,
  MarkdownRenderer,
  Notice,
  Platform,
  TFile,
  WorkspaceLeaf,
  getFrontMatterInfo,
  setIcon
} from "obsidian";
import type JustSimpleTeleprompterPlugin from "./plugin";
import { resolveTeleprompterAction } from "./input-controller";
import { ScrollEngine, clampScrollPosition } from "./scroll-engine";
import type { MotionState, ScrollDirection, TeleprompterAction } from "./types";
import { WakeLockController } from "./wake-lock-controller";

export const TELEPROMPTER_VIEW_TYPE = "just-simple-teleprompter-view";
const CONTROLS_HIDE_DELAY_MS = 1800;
const SPEED_STEP = 4;
const FONT_SIZE_STEP = 2;
const SOURCE_RELOAD_DELAY_MS = 200;

interface PlaybackSnapshot {
  scrollTop: number;
  direction: ScrollDirection;
  running: boolean;
}

export class TeleprompterView extends FileView {
  private rootEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  private readerEl: HTMLElement | null = null;
  private noteTitleEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private speedEl: HTMLElement | null = null;
  private fontSizeEl: HTMLElement | null = null;
  private mirrorHorizontalButton: HTMLButtonElement | null = null;
  private mirrorVerticalButton: HTMLButtonElement | null = null;
  private engine: ScrollEngine | null = null;
  private renderComponent: Component | null = null;
  private controlsTimer: number | null = null;
  private sourceReloadTimer: number | null = null;
  private preservedPlayback: PlaybackSnapshot | null = null;
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
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === this.file?.path) {
          this.scheduleSourceReload(file);
        }
      })
    );
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
    this.clearSourceReloadTimer();
    this.preservedPlayback = null;
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
    this.clearSourceReloadTimer();
    this.preservedPlayback = null;
    this.stopEngine();
    this.releaseRenderComponent();
    await this.wakeLock.destroy();
    this.contentEl.empty();
  }

  applySettings(): void {
    const settings = this.plugin.settings;
    this.rootEl?.style.setProperty("--jst-font-size", `${settings.fontSize}px`);
    this.rootEl?.style.setProperty("--jst-line-height", settings.lineHeight.toString());
    this.scrollEl?.toggleClass("is-mirrored-horizontally", settings.mirrorHorizontally);
    this.scrollEl?.toggleClass("is-mirrored-vertically", settings.mirrorVertically);
    this.engine?.setSpeed(settings.speed);
    this.updateSpeedLabel();
    this.updateReadingControlLabels();
    void this.wakeLock.setEnabled(settings.keepAwake);
  }

  canControlPlayback(): boolean {
    return this.engine !== null;
  }

  performAction(action: TeleprompterAction): boolean {
    if (this.engine === null) {
      return false;
    }

    switch (action) {
      case "forward":
        this.engine.press(1);
        break;
      case "reverse":
        this.engine.press(-1);
        break;
      case "toggle":
        this.engine.toggle();
        break;
      case "pause":
        this.engine.pause();
        break;
    }
    return true;
  }

  private buildInterface(): void {
    this.contentEl.empty();
    this.contentEl.addClass("jst-view-content");

    const root = this.contentEl.createDiv({ cls: "jst-root is-paused" });
    root.toggleClass("is-mobile-app", Platform.isMobileApp);
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
    const transport = controls.createDiv({ cls: "jst-transport" });
    this.createIconButton(transport, "arrow-up", "Reverse", "jst-transport-button", () => {
      this.engine?.press(-1);
    });
    this.playButton = this.createIconButton(
      transport,
      "play",
      "Resume",
      "jst-transport-button is-primary",
      () => this.engine?.toggle()
    );
    this.createIconButton(transport, "arrow-down", "Forward", "jst-transport-button", () => {
      this.engine?.press(1);
    });

    const readingControls = controls.createDiv({ cls: "jst-reading-controls" });
    const speedControls = readingControls.createDiv({
      cls: "jst-compact-control",
      attr: { role: "group", "aria-label": "Scroll speed" }
    });
    speedControls.createSpan({
      cls: "jst-control-label",
      text: "S",
      attr: { "aria-hidden": "true" }
    });
    this.createIconButton(speedControls, "minus", "Slower", "jst-small-button", () => {
      void this.changeSpeed(-SPEED_STEP);
    });
    this.speedEl = speedControls.createDiv({
      cls: "jst-speed jst-compact-value",
      text: "36 px/s",
      attr: { "aria-live": "polite" }
    });
    this.createIconButton(speedControls, "plus", "Faster", "jst-small-button", () => {
      void this.changeSpeed(SPEED_STEP);
    });

    const fontControls = readingControls.createDiv({
      cls: "jst-compact-control",
      attr: { role: "group", "aria-label": "Text size" }
    });
    fontControls.createSpan({
      cls: "jst-control-label",
      text: "A",
      attr: { "aria-hidden": "true" }
    });
    this.createIconButton(fontControls, "minus", "Smaller text", "jst-small-button", () => {
      void this.changeFontSize(-FONT_SIZE_STEP);
    });
    this.fontSizeEl = fontControls.createDiv({
      cls: "jst-font-size jst-compact-value",
      text: "44 px",
      attr: { "aria-live": "polite" }
    });
    this.createIconButton(fontControls, "plus", "Larger text", "jst-small-button", () => {
      void this.changeFontSize(FONT_SIZE_STEP);
    });

    const mirrorControls = readingControls.createDiv({
      cls: "jst-compact-control jst-mirror-controls",
      attr: { role: "group", "aria-label": "Text mirroring" }
    });
    this.mirrorHorizontalButton = this.createTextButton(
      mirrorControls,
      "H",
      "Mirror text horizontally",
      () => void this.toggleMirror("mirrorHorizontally")
    );
    this.mirrorVerticalButton = this.createTextButton(
      mirrorControls,
      "V",
      "Mirror text vertically",
      () => void this.toggleMirror("mirrorVertically")
    );

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

  private async renderFile(file: TFile, preservePlayback = false): Promise<void> {
    if (!this.readerEl || !this.scrollEl) {
      return;
    }

    if (preservePlayback) {
      this.preservedPlayback = this.capturePlayback() ?? this.preservedPlayback;
    } else {
      this.preservedPlayback = null;
    }
    const snapshot = this.preservedPlayback;
    const generation = ++this.renderGeneration;
    this.stopEngine(false);
    this.releaseRenderComponent();
    this.readerEl.empty();
    this.readerEl.createDiv({ cls: "jst-spacer jst-spacer-top" });
    const body = this.readerEl.createDiv({ cls: "jst-document" });
    body.setText("Loading…");
    this.noteTitleEl?.setText(file.basename);

    try {
      const raw = await this.app.vault.cachedRead(file);
      if (generation !== this.renderGeneration || file.path !== this.file?.path) {
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

      if (generation !== this.renderGeneration || file.path !== this.file?.path) {
        component.unload();
        return;
      }

      this.renderComponent = component;
      this.readerEl.createDiv({ cls: "jst-spacer jst-spacer-bottom" });
      this.scrollEl.scrollTop = snapshot
        ? clampScrollPosition(
            snapshot.scrollTop,
            this.scrollEl.scrollHeight,
            this.scrollEl.clientHeight
          )
        : 0;
      this.engine = new ScrollEngine(
        this.scrollEl,
        this.plugin.settings.speed,
        {
          onMotionChange: (state, direction) => this.handleMotionChange(state, direction),
          onBoundary: (direction) => this.handleBoundary(direction)
        }
      );
      this.applySettings();
      this.engine.restore(snapshot?.direction ?? 1, snapshot?.running ?? false);
      this.preservedPlayback = null;
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
      await this.renderFile(this.file, true);
    }
  }

  private scheduleSourceReload(file: TFile): void {
    this.clearSourceReloadTimer();
    const expectedPath = file.path;
    this.sourceReloadTimer = window.setTimeout(() => {
      this.sourceReloadTimer = null;
      if (this.isViewOpen && this.file?.path === expectedPath) {
        void this.renderFile(file, true);
      }
    }, SOURCE_RELOAD_DELAY_MS);
  }

  private capturePlayback(): PlaybackSnapshot | null {
    if (!this.engine || !this.scrollEl) {
      return null;
    }
    return {
      scrollTop: this.scrollEl.scrollTop,
      direction: this.engine.currentDirection,
      running: this.engine.isRunning
    };
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

    this.performAction(action);
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

  private clearSourceReloadTimer(): void {
    if (this.sourceReloadTimer !== null) {
      window.clearTimeout(this.sourceReloadTimer);
      this.sourceReloadTimer = null;
    }
  }

  private stopEngine(updateInterface = true): void {
    this.engine?.destroy();
    this.engine = null;
    if (updateInterface) {
      this.handleMotionChange("paused", 1);
    }
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

  private async changeFontSize(delta: number): Promise<void> {
    await this.plugin.updateSettings({ fontSize: this.plugin.settings.fontSize + delta });
    this.revealControls();
  }

  private async toggleMirror(
    key: "mirrorHorizontally" | "mirrorVertically"
  ): Promise<void> {
    await this.plugin.updateSettings({ [key]: !this.plugin.settings[key] });
    this.revealControls();
  }

  private updateSpeedLabel(): void {
    this.speedEl?.setText(`${Math.round(this.plugin.settings.speed)} px/s`);
  }

  private updateReadingControlLabels(): void {
    this.fontSizeEl?.setText(`${Math.round(this.plugin.settings.fontSize)} px`);
    this.updateToggleButton(
      this.mirrorHorizontalButton,
      this.plugin.settings.mirrorHorizontally
    );
    this.updateToggleButton(this.mirrorVerticalButton, this.plugin.settings.mirrorVertically);
  }

  private updateToggleButton(button: HTMLButtonElement | null, active: boolean): void {
    button?.toggleClass("is-active", active);
    button?.setAttribute("aria-pressed", active ? "true" : "false");
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

  private createTextButton(
    parent: HTMLElement,
    text: string,
    label: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: "jst-small-button jst-text-button",
      text,
      attr: {
        type: "button",
        "aria-label": label,
        "aria-pressed": "false",
        "data-tooltip-position": "top"
      }
    });
    this.registerDomEvent(button, "click", (event) => {
      event.preventDefault();
      onClick();
    });
    return button;
  }
}
