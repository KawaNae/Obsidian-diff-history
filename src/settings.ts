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
      .addSlider((slider) =>
        slider
          .setLimits(1, 90, 1)
          .setValue(this.plugin.settings.retentionDays)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.retentionDays = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Debounce interval (seconds)")
      .setDesc("Wait this long after the last edit before saving a diff. Prevents excessive saves during rapid typing.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.debounceMs / 1000)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.debounceMs = value * 1000;
            await this.plugin.saveSettings();
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
