import { App, Modal, setIcon } from "obsidian";
import {
  bindingFromKeyboardInput,
  describeBinding,
  describeKeyboardInput
} from "./input-controller";
import type { KeyboardInput } from "./input-controller";

export class KeyCaptureModal extends Modal {
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private isSaving = false;

  constructor(
    app: App,
    private readonly pedalName: string,
    private readonly onCapture: (binding: string, input: KeyboardInput) => Promise<void>
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

      if (this.isSaving) {
        return;
      }

      const legacyEvent = event as unknown as {
        keyCode?: number;
        which?: number;
        keyIdentifier?: string;
      };
      const input: KeyboardInput = {
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        keyCode: legacyEvent.keyCode,
        which: legacyEvent.which,
        keyIdentifier: legacyEvent.keyIdentifier
      };
      diagnostic.setText(describeKeyboardInput(input));

      if (input.key === "Escape") {
        this.close();
        return;
      }

      if (isModifierOnly(input.key)) {
        prompt.setText("Modifier keys cannot be assigned on their own.");
        return;
      }

      if (input.code === "Space" || input.key === " ") {
        prompt.setText("Space is reserved for pause/resume. Press another pedal key.");
        return;
      }

      const binding = bindingFromKeyboardInput(input);
      if (binding === null) {
        prompt.setText("iOS reported an unidentified key. Try another pedal mode.");
        return;
      }

      this.isSaving = true;
      prompt.setText(`Saving ${describeBinding(binding)}…`);
      void this.saveCapture(binding, input, prompt, diagnostic);
    };

    window.addEventListener("keydown", this.keydownHandler, true);
  }

  private async saveCapture(
    binding: string,
    input: KeyboardInput,
    prompt: HTMLParagraphElement,
    diagnostic: HTMLParagraphElement
  ): Promise<void> {
    try {
      await this.onCapture(binding, input);
      this.close();
    } catch (error) {
      this.isSaving = false;
      prompt.setText("The key was received, but its assignment could not be saved. Try again.");
      diagnostic.setText(`${describeKeyboardInput(input)} · save failed`);
      console.error("Just Simple Teleprompter could not save a pedal binding", error);
    }
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
  return `Learned: ${describeBinding(binding)} · ${describeKeyboardInput(input).replace("Received ", "")}`;
}
