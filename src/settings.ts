import { App, PluginSettingTab, Setting } from "obsidian";
import type DiffHistoryPlugin from "./main";

export class DiffHistorySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: DiffHistoryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Retention period (days)")
      .setDesc("How many days to keep diff history. Older records are automatically deleted.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.retentionDays))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.retentionDays = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Debounce interval (seconds)")
      .setDesc("Wait this long after the last edit before saving a diff. Prevents excessive saves during rapid typing.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.debounceMs / 1000))
          .onChange(async (value) => {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.debounceMs = num * 1000;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Minimum interval (seconds)")
      .setDesc("Minimum time between consecutive saves for the same file. Prevents excessive history entries.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.minIntervalMs / 1000))
          .onChange(async (value) => {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.minIntervalMs = num * 1000;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Exclude patterns")
      .setDesc("Glob patterns for files/folders to exclude (one per line). Example: templates/**")
      .addTextArea((text) =>
        text
          .setPlaceholder("templates/**\ndaily/**")
          .setValue(this.plugin.settings.excludePatterns.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludePatterns = value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max storage (MB)")
      .setDesc("Maximum IndexedDB storage usage. Oldest records are deleted when exceeded.")
      .addSlider((slider) =>
        slider
          .setLimits(50, 1000, 50)
          .setValue(this.plugin.settings.maxStorageMB)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxStorageMB = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Clear all history")
      .setDesc("Permanently delete all saved diffs and snapshots.")
      .addButton((button) =>
        button
          .setButtonText("Clear")
          .setWarning()
          .onClick(async () => {
            await this.plugin.clearAllHistory();
          })
      );
  }
}
