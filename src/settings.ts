import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type JustSimpleTeleprompterPlugin from "./plugin";
import { describeBinding } from "./input-controller";
import { capturedBindingNotice, KeyCaptureModal } from "./key-capture-modal";

export class JustSimpleTeleprompterSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly teleprompter: JustSimpleTeleprompterPlugin) {
    super(app, teleprompter);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("jst-settings");

    new Setting(containerEl).setName("Reading").setHeading();

    new Setting(containerEl)
      .setName("Scroll speed")
      .setDesc(`${Math.round(this.teleprompter.settings.speed)} pixels per second`)
      .addSlider((slider) => {
        slider
          .setLimits(4, 160, 2)
          .setValue(this.teleprompter.settings.speed)
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.teleprompter.updateSettings({ speed: value });
          });
      });

    new Setting(containerEl)
      .setName("Text size")
      .setDesc(`${Math.round(this.teleprompter.settings.fontSize)} pixels`)
      .addSlider((slider) => {
        slider
          .setLimits(24, 96, 2)
          .setValue(this.teleprompter.settings.fontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.teleprompter.updateSettings({ fontSize: value });
          });
      });

    new Setting(containerEl)
      .setName("Line spacing")
      .setDesc(this.teleprompter.settings.lineHeight.toFixed(2))
      .addSlider((slider) => {
        slider
          .setLimits(1, 2, 0.05)
          .setValue(this.teleprompter.settings.lineHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            await this.teleprompter.updateSettings({ lineHeight: value });
          });
      });

    new Setting(containerEl)
      .setName("Mirror text horizontally")
      .setDesc("For teleprompters that use reflective glass.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.teleprompter.settings.mirrorHorizontally)
          .onChange((value) => this.teleprompter.updateSettings({ mirrorHorizontally: value }));
      });

    new Setting(containerEl)
      .setName("Keep screen awake")
      .setDesc("Uses the device wake lock when the platform supports it.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.teleprompter.settings.keepAwake)
          .onChange((value) => this.teleprompter.updateSettings({ keepAwake: value }));
      });

    new Setting(containerEl).setName("Bluetooth pedals").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description jst-settings-intro",
      text: "Automatic mode accepts arrow keys and Page Up/Page Down. Use Learn only if your pedal sends different keys."
    });

    this.addPedalSetting("Left pedal", "reverse", "leftPedalBinding");
    this.addPedalSetting("Right pedal", "forward", "rightPedalBinding");

    new Setting(containerEl)
      .setName("Pause or resume")
      .setDesc("Space bar, or the center button on screen. Escape always pauses.");
  }

  private addPedalSetting(
    name: string,
    action: "reverse" | "forward",
    key: "leftPedalBinding" | "rightPedalBinding"
  ): void {
    const binding = this.teleprompter.settings[key];
    const setting = new Setting(this.containerEl)
      .setName(name)
      .setDesc(`${action === "reverse" ? "Reverse" : "Forward"} · ${describeBinding(binding)}`);

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
            this.display();
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
            void this.teleprompter.updateSettings({ [key]: null }).then(() => this.display());
          });
      });
    }
  }
}
