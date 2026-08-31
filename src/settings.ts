import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type {
  ExtraButtonComponent,
  SettingDefinition,
  SettingDefinitionItem
} from "obsidian";
import type JustSimpleTeleprompterPlugin from "./plugin";
import { describeBinding } from "./input-controller";
import { InputInspectorModal } from "./input-inspector-modal";
import { capturedBindingNotice, KeyCaptureModal } from "./key-capture-modal";
import { DEFAULT_SETTINGS } from "./types";
import type { TeleprompterSettings } from "./types";

type SettingKey = keyof TeleprompterSettings;
type PedalBindingKey = "leftPedalBinding" | "rightPedalBinding";

export class JustSimpleTeleprompterSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly teleprompter: JustSimpleTeleprompterPlugin) {
    super(app, teleprompter);
  }

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: "Scroll speed",
        desc: "Automatic scrolling speed.",
        control: {
          type: "slider",
          key: "speed",
          defaultValue: DEFAULT_SETTINGS.speed,
          min: 4,
          max: 160,
          step: 2,
          displayFormat: (value) => `${Math.round(value)} px/s`
        }
      },
      {
        name: "Text size",
        desc: "Teleprompter text size.",
        control: {
          type: "slider",
          key: "fontSize",
          defaultValue: DEFAULT_SETTINGS.fontSize,
          min: 24,
          max: 96,
          step: 2,
          displayFormat: (value) => `${Math.round(value)} px`
        }
      },
      {
        name: "Line spacing",
        desc: "Space between lines of teleprompter text.",
        control: {
          type: "slider",
          key: "lineHeight",
          defaultValue: DEFAULT_SETTINGS.lineHeight,
          min: 1,
          max: 2,
          step: 0.05,
          displayFormat: (value) => value.toFixed(2)
        }
      },
      {
        name: "Mirror text horizontally",
        desc: "Flip the text from left to right.",
        control: {
          type: "toggle",
          key: "mirrorHorizontally",
          defaultValue: DEFAULT_SETTINGS.mirrorHorizontally
        }
      },
      {
        name: "Mirror text vertically",
        desc: "Flip the text from top to bottom.",
        control: {
          type: "toggle",
          key: "mirrorVertically",
          defaultValue: DEFAULT_SETTINGS.mirrorVertically
        }
      },
      {
        name: "Keep screen awake",
        desc: "Uses the device wake lock when the platform supports it.",
        control: {
          type: "toggle",
          key: "keepAwake",
          defaultValue: DEFAULT_SETTINGS.keepAwake
        }
      },
      {
        type: "group",
        heading: "Bluetooth pedals",
        items: [
          {
            name: "Pedal behavior",
            desc: "When paused, down starts forward and up starts reverse. While moving, either key pauses. Built-in Obsidian shortcuts use only the up and down arrow keys without Learn."
          },
          this.createPedalDefinition("Left pedal", "reverse", "leftPedalBinding"),
          this.createPedalDefinition("Right pedal", "forward", "rightPedalBinding"),
          {
            name: "Pause or resume",
            desc: "Space bar, or the center button on screen. Escape always pauses."
          },
          {
            name: "Pedal input inspector",
            desc: "See what an iPhone or iPad actually receives from the pedal.",
            render: (setting) => {
              setting.addButton((button) => {
                button.setButtonText("Inspect input").onClick(() => {
                  new InputInspectorModal(this.app).open();
                });
              });
            }
          }
        ]
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (isSettingKey(key)) {
      return this.teleprompter.settings[key];
    }
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case "speed":
      case "fontSize":
      case "lineHeight":
        if (typeof value === "number") {
          await this.teleprompter.updateSettings({ [key]: value });
          return;
        }
        break;
      case "mirrorHorizontally":
      case "mirrorVertically":
      case "keepAwake":
        if (typeof value === "boolean") {
          await this.teleprompter.updateSettings({ [key]: value });
          return;
        }
        break;
    }
    throw new Error(`Invalid setting value for ${key}`);
  }

  private createPedalDefinition(
    name: string,
    action: "reverse" | "forward",
    key: PedalBindingKey
  ): SettingDefinition<SettingKey> {
    const binding = this.teleprompter.settings[key];
    return {
      name,
      desc: `${action === "reverse" ? "Reverse" : "Forward"} - ${describeBinding(binding)}`,
      render: (setting) => this.addPedalControls(setting, name, action, key)
    };
  }

  private addPedalControls(
    setting: Setting,
    name: string,
    action: "reverse" | "forward",
    key: PedalBindingKey
  ): void {
    const binding = this.teleprompter.settings[key];
    let resetButton: ExtraButtonComponent | null = null;
    const showBinding = (value: string | null): void => {
      setting.setDesc(
        `${action === "reverse" ? "Reverse" : "Forward"} - ${describeBinding(value)}`
      );
      resetButton?.setDisabled(value === null);
    };

    setting.addButton((button) => {
      button.setButtonText("Learn").onClick(() => {
        new KeyCaptureModal(this.app, name.toLowerCase(), async (captured, input) => {
          const otherKey = key === "leftPedalBinding" ? "rightPedalBinding" : "leftPedalBinding";
          const patch = {
            [key]: captured,
            ...(this.teleprompter.settings[otherKey] === captured ? { [otherKey]: null } : {})
          };
          await this.teleprompter.updateSettings(patch);

          if (this.teleprompter.settings[key] !== captured) {
            throw new Error("The saved pedal binding did not match the captured key");
          }

          showBinding(captured);
          this.update();
          new Notice(capturedBindingNotice(captured, input));
        }).open();
      });
    });

    setting.addExtraButton((button) => {
      resetButton = button;
      button
        .setIcon("reset")
        .setTooltip("Use automatic keys")
        .setDisabled(binding === null)
        .onClick(() => {
          void this.teleprompter.updateSettings({ [key]: null }).then(() => {
            showBinding(null);
            this.update();
          });
        });
    });
  }
}

function isSettingKey(key: string): key is SettingKey {
  return [
    "speed",
    "fontSize",
    "lineHeight",
    "mirrorHorizontally",
    "mirrorVertically",
    "keepAwake",
    "leftPedalBinding",
    "rightPedalBinding"
  ].includes(key);
}
