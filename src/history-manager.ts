import type { Vault, TFile } from "obsidian";
import { DiffEngine } from "./diff-engine";
import { StorageManager } from "./storage";
import type { EventListener } from "./event-listener";
import type { DiffRecord, DiffHistorySettings } from "./types";

export interface HistoryEntry {
  record: DiffRecord;
  added: number;
  removed: number;
}

export class HistoryManager {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private eventListener: EventListener | null = null;

  constructor(
    private vault: Vault,
    private storage: StorageManager,
    private diffEngine: DiffEngine,
    private getSettings: () => DiffHistorySettings
  ) {}

  setEventListener(listener: EventListener): void {
    this.eventListener = listener;
  }

  async getSnapshot(filePath: string) {
    return this.storage.getSnapshot(filePath);
  }

  async getFileHistory(filePath: string): Promise<HistoryEntry[]> {
    const diffs = await this.storage.getDiffs(filePath);
    return diffs.map((record) => {
      // Use stored values if available, fall back to estimation for legacy data
      const added = record.added ?? this.estimateChangesFromPatch(record.patches).added;
      const removed = record.removed ?? this.estimateChangesFromPatch(record.patches).removed;
      return { record, added, removed };
    });
  }

  async reconstructAtPoint(
    filePath: string,
    timestamp: number
  ): Promise<string | null> {
    const snapshot = await this.storage.getSnapshot(filePath);
    if (!snapshot) return null;

    // Get all diffs after the target timestamp (we need to reverse these)
    const allDiffs = await this.storage.getDiffs(filePath);
    const diffsToReverse = allDiffs
      .filter((d) => d.timestamp > timestamp)
      .sort((a, b) => b.timestamp - a.timestamp); // newest first for reversal

    let content = snapshot.content;
    for (const diff of diffsToReverse) {
      const result = this.diffEngine.applyPatchReverse(content, diff.patches);
      if (!result.ok) {
        console.warn(
          "[diff-history] Patch reverse failed at",
          diff.timestamp
        );
        return null;
      }
      content = result.text;
    }
    return content;
  }

  async restoreToPoint(
    filePath: string,
    timestamp: number
  ): Promise<boolean> {
    const reconstructed = await this.reconstructAtPoint(filePath, timestamp);
    if (reconstructed === null) return false;

    const file = this.vault.getAbstractFileByPath(filePath);
    if (!file || !("extension" in file)) return false;

    // Pause event listener to prevent re-capturing the restore as a new diff
    this.eventListener?.pause();
    try {
      await this.vault.modify(file as TFile, reconstructed);
      // Update the snapshot to the restored content
      await this.storage.saveSnapshot(filePath, reconstructed);
    } finally {
      // Resume after a tick to let the editor settle
      setTimeout(() => this.eventListener?.resume(), 500);
    }
    return true;
  }

  startCleanup(): void {
    // Run immediately on start
    this.cleanup();
    // Then every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async cleanup(): Promise<number> {
    const settings = this.getSettings();
    const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
    return this.storage.deleteBefore(cutoff);
  }

  private estimateChangesFromPatch(
    patchStr: string
  ): { added: number; removed: number } {
    // Rough estimation from patch text for legacy data without stored line counts
    let added = 0;
    let removed = 0;
    const lines = patchStr.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") || line.startsWith("%2B")) {
        added++;
      } else if (line.startsWith("-") || line.startsWith("%2D")) {
        removed++;
      }
    }
    return { added: Math.max(added, 0), removed: Math.max(removed, 0) };
  }
}
