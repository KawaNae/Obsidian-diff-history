import { Plugin, Notice, TFile } from "obsidian";
import { DiffHistorySettings, DEFAULT_SETTINGS } from "./types";
import { StorageManager } from "./storage";
import { DiffEngine } from "./diff-engine";
import { EventListener } from "./event-listener";
import { HistoryManager } from "./history-manager";
import { DiffHistorySettingTab } from "./settings";
import {
  DiffHistoryView,
  VIEW_TYPE_DIFF_HISTORY,
} from "./history-view";

export default class DiffHistoryPlugin extends Plugin {
  settings: DiffHistorySettings = { ...DEFAULT_SETTINGS };

  private storage!: StorageManager;
  private diffEngine!: DiffEngine;
  private eventListener!: EventListener;
  historyManager!: HistoryManager;

  async onload() {
    await this.loadSettings();

    // Core services
    this.storage = new StorageManager();
    this.diffEngine = new DiffEngine();
    this.eventListener = new EventListener(
      this.app.vault,
      this.storage,
      this.diffEngine,
      () => this.settings
    );
    this.historyManager = new HistoryManager(
      this.app.vault,
      this.storage,
      this.diffEngine,
      () => this.settings
    );
    this.historyManager.setEventListener(this.eventListener);

    // Start event listening
    this.eventListener.start();
    for (const ref of this.eventListener.getEventRefs()) {
      this.registerEvent(ref);
    }

    // Start cleanup timer
    this.historyManager.startCleanup();

    // Register sidebar view
    this.registerView(VIEW_TYPE_DIFF_HISTORY, (leaf) => {
      return new DiffHistoryView(leaf, this);
    });

    // Register commands
    this.addCommand({
      id: "show-file-history",
      name: "Show file history",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (checking) return true;
        this.showHistory(file);
      },
    });

    this.addCommand({
      id: "restore-to-point",
      name: "Restore to point",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (checking) return true;
        this.showHistory(file);
      },
    });

    this.addCommand({
      id: "clear-file-history",
      name: "Clear current file history",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (checking) return true;
        this.clearFileHistory(file);
      },
    });

    // Settings tab
    this.addSettingTab(new DiffHistorySettingTab(this.app, this));
  }

  onunload() {
    this.eventListener?.stop();
    this.historyManager?.stopCleanup();
    this.storage?.close();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async clearAllHistory(): Promise<void> {
    await this.storage.deleteAll();
    new Notice("All diff history cleared.");
  }

  private async showHistory(file: TFile): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_DIFF_HISTORY)[0];
    if (!leaf) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({
        type: VIEW_TYPE_DIFF_HISTORY,
        active: true,
      });
    }
    this.app.workspace.revealLeaf(leaf);

    const view = leaf.view as DiffHistoryView;
    await view.showFileHistory(file.path);
  }

  private async clearFileHistory(file: TFile): Promise<void> {
    const deleted = await this.storage.deleteByFile(file.path);
    new Notice(`Cleared ${deleted} history entries for ${file.basename}.`);
  }
}
