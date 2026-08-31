import { App, Modal, Notice, Platform, setIcon } from "obsidian";

const MAX_EVENTS = 40;
const EVENT_TYPES = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "pointerdown",
  "pointerup",
  "pointercancel",
  "mousedown",
  "mouseup",
  "click",
  "auxclick",
  "contextmenu",
  "touchstart",
  "touchmove",
  "touchend",
  "touchcancel",
  "wheel",
  "focusin",
  "focusout",
  "scroll"
] as const;

interface LegacyKeyboardEvent {
  keyCode?: number;
  which?: number;
  keyIdentifier?: string;
}

export class InputInspectorModal extends Modal {
  private readonly startedAt = performance.now();
  private readonly entries: string[] = [];
  private readonly listeners: Array<{
    type: (typeof EVENT_TYPES)[number];
    handler: EventListener;
  }> = [];
  private logEl: HTMLTextAreaElement | null = null;
  private countEl: HTMLElement | null = null;
  private readyTimer: number | null = null;
  private ready = false;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Pedal input inspector");
    this.contentEl.empty();
    this.modalEl.addClass("jst-input-inspector-modal");

    const intro = this.contentEl.createEl("p", {
      text: "Do not touch the screen after this opens. Press the left pedal once, wait a second, then press the right pedal once."
    });
    intro.addClass("jst-input-inspector-intro");

    const status = this.contentEl.createDiv({ cls: "jst-input-inspector-status" });
    const statusIcon = status.createSpan({ cls: "jst-input-inspector-status-icon" });
    setIcon(statusIcon, "radio");
    this.countEl = status.createSpan({ text: "Getting ready…" });

    this.logEl = this.contentEl.createEl("textarea", {
      cls: "jst-input-inspector-log",
      attr: {
        readonly: "true",
        spellcheck: "false",
        "aria-label": "Captured pedal input events"
      }
    });
    this.logEl.value = "Waiting for pedal input…";

    const actions = this.contentEl.createDiv({ cls: "jst-input-inspector-actions" });
    const clearButton = actions.createEl("button", { text: "Clear" });
    clearButton.addEventListener("click", () => this.clearLog());
    const copyButton = actions.createEl("button", { text: "Copy diagnostics" });
    copyButton.addClass("mod-cta");
    copyButton.addEventListener("click", () => void this.copyDiagnostics());

    for (const type of EVENT_TYPES) {
      const handler: EventListener = (event) => this.captureEvent(event);
      window.addEventListener(type, handler, true);
      this.listeners.push({ type, handler });
    }

    this.readyTimer = window.setTimeout(() => {
      this.readyTimer = null;
      this.ready = true;
      this.clearLog();
    }, 700);
  }

  onClose(): void {
    if (this.readyTimer !== null) {
      window.clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    for (const { type, handler } of this.listeners) {
      window.removeEventListener(type, handler, true);
    }
    this.listeners.length = 0;
    this.contentEl.empty();
  }

  private captureEvent(event: Event): void {
    if (
      !this.ready ||
      this.isInspectorControl(event.target) ||
      (event.type === "scroll" && event.target === this.logEl)
    ) {
      return;
    }

    const elapsed = ((performance.now() - this.startedAt) / 1000).toFixed(3);
    this.entries.push(`${elapsed}s  ${describeInputEvent(event)}`);
    if (this.entries.length > MAX_EVENTS) {
      this.entries.splice(0, this.entries.length - MAX_EVENTS);
    }
    this.renderLog();
  }

  private isInspectorControl(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(".jst-input-inspector-actions") !== null;
  }

  private clearLog(): void {
    this.entries.length = 0;
    this.renderLog();
  }

  private renderLog(): void {
    if (this.logEl) {
      this.logEl.value = this.entries.length > 0
        ? this.entries.join("\n")
        : "Waiting for pedal input…";
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    this.countEl?.setText(
      this.entries.length === 0
        ? "Listening — press the pedals"
        : `${this.entries.length} event${this.entries.length === 1 ? "" : "s"} captured`
    );
  }

  private async copyDiagnostics(): Promise<void> {
    const body = this.entries.length > 0
      ? this.entries.join("\n")
      : "No input events captured.";
    const diagnostics = [
      "Just Simple Teleprompter pedal diagnostics",
      `Platform: ${platformDescription()}`,
      body
    ].join("\n");

    try {
      await navigator.clipboard.writeText(diagnostics);
      new Notice("Pedal diagnostics copied.");
    } catch {
      this.logEl?.focus();
      this.logEl?.select();
      new Notice("Select and copy the diagnostics shown in the box.");
    }
  }
}

export function describeInputEvent(event: Event): string {
  const target = describeTarget(event.target);

  if (event instanceof KeyboardEvent) {
    const legacy = event as unknown as LegacyKeyboardEvent;
    return [
      event.type,
      `key=${quoted(event.key)}`,
      `code=${quoted(event.code)}`,
      `keyCode=${legacy.keyCode ?? 0}`,
      `which=${legacy.which ?? 0}`,
      legacy.keyIdentifier ? `keyIdentifier=${quoted(legacy.keyIdentifier)}` : "",
      event.repeat ? "repeat=true" : "",
      `target=${target}`
    ].filter(Boolean).join(" · ");
  }

  if (event instanceof PointerEvent) {
    return [
      event.type,
      `pointer=${event.pointerType || "unknown"}`,
      `button=${event.button}`,
      `buttons=${event.buttons}`,
      `x=${Math.round(event.clientX)}`,
      `y=${Math.round(event.clientY)}`,
      `pressure=${event.pressure}`,
      `target=${target}`
    ].join(" · ");
  }

  if (event instanceof WheelEvent) {
    return [
      event.type,
      `deltaX=${round(event.deltaX)}`,
      `deltaY=${round(event.deltaY)}`,
      `mode=${event.deltaMode}`,
      `target=${target}`
    ].join(" · ");
  }

  if (event instanceof MouseEvent) {
    return [
      event.type,
      `button=${event.button}`,
      `buttons=${event.buttons}`,
      `x=${Math.round(event.clientX)}`,
      `y=${Math.round(event.clientY)}`,
      `detail=${event.detail}`,
      `target=${target}`
    ].join(" · ");
  }

  if (event instanceof TouchEvent) {
    const touch = event.changedTouches.item(0);
    return [
      event.type,
      `touches=${event.touches.length}`,
      `changed=${event.changedTouches.length}`,
      touch ? `x=${Math.round(touch.clientX)}` : "",
      touch ? `y=${Math.round(touch.clientY)}` : "",
      `target=${target}`
    ].filter(Boolean).join(" · ");
  }

  if (event instanceof InputEvent) {
    return [
      event.type,
      `inputType=${quoted(event.inputType)}`,
      `data=${quoted(event.data ?? "")}`,
      `target=${target}`
    ].join(" · ");
  }

  if (event.type === "scroll") {
    const element = event.target instanceof Element ? event.target : null;
    return [
      event.type,
      element instanceof HTMLElement ? `top=${Math.round(element.scrollTop)}` : "",
      element instanceof HTMLElement ? `left=${Math.round(element.scrollLeft)}` : "",
      `target=${target}`
    ].filter(Boolean).join(" · ");
  }

  return `${event.type} · target=${target}`;
}

function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return target === window ? "window" : "unknown";
  }
  const id = target.id ? `#${target.id}` : "";
  const classes = Array.from(target.classList).slice(0, 2).map((name) => `.${name}`).join("");
  return `${target.tagName.toLowerCase()}${id}${classes}`;
}

function quoted(value: string): string {
  return JSON.stringify(value || "(empty)");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function platformDescription(): string {
  if (Platform.isIosApp) {
    return "iOS app";
  }
  if (Platform.isAndroidApp) {
    return "Android app";
  }
  if (Platform.isDesktopApp) {
    return "desktop app";
  }
  return Platform.isMobile ? "mobile browser" : "desktop browser";
}
