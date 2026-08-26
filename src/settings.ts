import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
import type JustSimpleTeleprompterPlugin from "./plugin";
import { describeBinding } from "./input-controller";
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
        desc: "For teleprompters that use reflective glass.",
        control: {
          type: "toggle",
          key: "mirrorHorizontally",
          defaultValue: DEFAULT_SETTINGS.mirrorHorizontally
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
            desc: "When paused, right starts forward and left starts reverse. While moving, either pedal pauses. Automatic mode accepts arrow keys and page up/page down."
          },
          this.createPedalDefinition("Left pedal", "reverse", "leftPedalBinding"),
          this.createPedalDefinition("Right pedal", "forward", "rightPedalBinding"),
          {
            name: "Pause or resume",
            desc: "Space bar, or the center button on screen. Escape always pauses."
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
      render: (setting) => this.addPedalControls(setting, name, key)
    };
  }

  private addPedalControls(setting: Setting, name: string, key: PedalBindingKey): void {
    const binding = this.teleprompter.settings[key];
    setting.addButton((button) => {
      button.setButtonText("Learn").onClick(() => {
        new KeyCaptureModal(this.app, name.toLowerCase(), (captured) => {
          const otherKey = key === "leftPedalBinding" ? "rightPedalBinding" : "leftPedalBinding";
          const patch = {
            [key]: captured,
            ...(this.teleprompter.settings[otherKey] === captured ? { [otherKey]: null } : {})
          };
          void this.teleprompter.updateSettings(patch).then(() => {
            new Notice(capturedBindingNotice(captured));
            this.update();
          });
        }).open();
      });
    });

    if (binding !== null) {
      setting.addExtraButton((button) => {
        button
          .setIcon("reset")
          .setTooltip("Use automatic keys")
          .onClick(() => {
            void this.teleprompter.updateSettings({ [key]: null }).then(() => this.update());
          });
      });
    }
  }
}

function isSettingKey(key: string): key is SettingKey {
  return [
    "speed",
    "fontSize",
    "lineHeight",
    "mirrorHorizontally",
    "keepAwake",
    "leftPedalBinding",
    "rightPedalBinding"
  ].includes(key);
}
