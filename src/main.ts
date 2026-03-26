import { Plugin } from "obsidian";
import { DiffHistorySettings, DEFAULT_SETTINGS } from "./types";

export default class DiffHistoryPlugin extends Plugin {
  settings: DiffHistorySettings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
  }

  onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
