import type { Vault, TAbstractFile, TFile, EventRef } from "obsidian";
import { DiffEngine } from "./diff-engine";
import { StorageManager } from "./storage";
import type { DiffHistorySettings } from "./types";
import { minimatch } from "./utils";

export class EventListener {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private eventRefs: EventRef[] = [];

  constructor(
    private vault: Vault,
    private storage: StorageManager,
    private diffEngine: DiffEngine,
    private getSettings: () => DiffHistorySettings
  ) {}

  start(): void {
    const modifyRef = this.vault.on("modify", (file: TAbstractFile) => {
      if (!this.isTargetFile(file)) return;
      this.scheduleCapture(file as TFile);
    });
    this.eventRefs.push(modifyRef);

    const renameRef = this.vault.on(
      "rename",
      (file: TAbstractFile, oldPath: string) => {
        if (!("extension" in file)) return;
        this.storage.renamePath(oldPath, file.path);
      }
    );
    this.eventRefs.push(renameRef);

    const deleteRef = this.vault.on("delete", (file: TAbstractFile) => {
      // Keep history for deleted files — user may want to recover
    });
    this.eventRefs.push(deleteRef);
  }

  stop(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  getEventRefs(): EventRef[] {
    return this.eventRefs;
  }

  private isTargetFile(file: TAbstractFile): boolean {
    if (!("extension" in file)) return false;
    const tfile = file as TFile;
    if (tfile.extension !== "md") return false;

    const settings = this.getSettings();
    for (const pattern of settings.excludePatterns) {
      if (minimatch(tfile.path, pattern)) return false;
    }
    return true;
  }

  private scheduleCapture(file: TFile): void {
    const existing = this.debounceTimers.get(file.path);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(file.path);
      this.captureChange(file);
    }, this.getSettings().debounceMs);

    this.debounceTimers.set(file.path, timer);
  }

  private async captureChange(file: TFile): Promise<void> {
    try {
      const currentContent = await this.vault.cachedRead(file);
      const snapshot = await this.storage.getSnapshot(file.path);

      if (snapshot) {
        // Compute diff from previous content
        if (snapshot.content === currentContent) return; // No actual change

        const patches = this.diffEngine.computePatch(
          snapshot.content,
          currentContent
        );
        const baseHash = this.diffEngine.computeHash(snapshot.content);
        await this.storage.saveDiff(file.path, patches, baseHash);
      }

      // Always update the snapshot to latest
      await this.storage.saveSnapshot(file.path, currentContent);
    } catch (e) {
      console.error("[diff-history] Failed to capture change:", e);
    }
  }
}
