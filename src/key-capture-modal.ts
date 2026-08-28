import { App, Modal, setIcon } from "obsidian";
import {
  bindingFromKeyboardInput,
  describeBinding,
  describeKeyboardInput
} from "./input-controller";
import type { KeyboardInput } from "./input-controller";

export class KeyCaptureModal extends Modal {
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    app: App,
    private readonly pedalName: string,
    private readonly onCapture: (binding: string, input: KeyboardInput) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(`Learn ${this.pedalName} pedal`);
    this.contentEl.empty();
    this.modalEl.addClass("jst-key-capture-modal");

    const icon = this.contentEl.createDiv({ cls: "jst-key-capture-icon" });
    setIcon(icon, "keyboard");
    const prompt = this.contentEl.createEl("p", {
      text: "Press the pedal once. Press escape to cancel."
    });
    const diagnostic = this.contentEl.createEl("p", {
      cls: "jst-key-capture-diagnostic",
      text: "Waiting for a keyboard event…"
    });

    this.keydownHandler = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      diagnostic.setText(describeKeyboardInput(event));

      if (event.key === "Escape") {
        this.close();
        return;
      }

      if (isModifierOnly(event.key)) {
        prompt.setText("Modifier keys cannot be assigned on their own.");
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        prompt.setText("Space is reserved for pause/resume. Press another pedal key.");
        return;
      }

      const binding = bindingFromKeyboardInput(event);
      if (binding === null) {
        prompt.setText("iOS reported an unidentified key. Try another pedal mode.");
        return;
      }

      this.onCapture(binding, event);
      this.close();
    };

    window.addEventListener("keydown", this.keydownHandler, true);
  }

  onClose(): void {
    if (this.keydownHandler !== null) {
      window.removeEventListener("keydown", this.keydownHandler, true);
      this.keydownHandler = null;
    }
    this.contentEl.empty();
  }
}

function isModifierOnly(key: string): boolean {
  return ["Alt", "AltGraph", "Control", "Meta", "Shift"].includes(key);
}

export function capturedBindingNotice(binding: string, input: KeyboardInput): string {
  return `Learned: ${describeBinding(binding)} · key: ${input.key || "(empty)"} · code: ${input.code || "(empty)"}`;
}
