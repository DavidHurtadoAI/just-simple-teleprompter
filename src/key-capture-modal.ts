import { App, Modal, setIcon } from "obsidian";
import { bindingFromKeyboardInput, describeBinding } from "./input-controller";

export class KeyCaptureModal extends Modal {
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    app: App,
    private readonly pedalName: string,
    private readonly onCapture: (binding: string) => void
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
      text: "Press the pedal once. Press Escape to cancel."
    });

    this.keydownHandler = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        this.close();
        return;
      }

      if (event.repeat || isModifierOnly(event.key)) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        prompt.setText("Space is reserved for pause/resume. Press another pedal key.");
        return;
      }

      const binding = bindingFromKeyboardInput(event);
      this.onCapture(binding);
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

export function capturedBindingNotice(binding: string): string {
  return `Learned: ${describeBinding(binding)}`;
}
