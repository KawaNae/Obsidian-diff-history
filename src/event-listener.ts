import type { Vault, TAbstractFile, TFile, EventRef } from "obsidian";
import { DiffEngine } from "./diff-engine";
import { StorageManager } from "./storage";
import type { DiffHistorySettings } from "./types";
import { minimatch } from "./utils";

export class EventListener {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastCaptureTime = new Map<string, number>();
  private pendingCapture = new Map<string, ReturnType<typeof setTimeout>>();
  private eventRefs: EventRef[] = [];
  private paused = false;

  onDiffSaved?: (filePath: string) => void;
  onSnapshotCreated?: (filePath: string) => void;

  constructor(
    private vault: Vault,
    private storage: StorageManager,
    private diffEngine: DiffEngine,
    private getSettings: () => DiffHistorySettings
  ) {}

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  start(): void {
    const modifyRef = this.vault.on("modify", (file: TAbstractFile) => {
      if (this.paused) return;
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
    for (const timer of this.pendingCapture.values()) {
      clearTimeout(timer);
    }
    this.pendingCapture.clear();
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
    // Clear existing debounce timer
    const existing = this.debounceTimers.get(file.path);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(file.path);
      this.tryCapture(file);
    }, this.getSettings().debounceMs);

    this.debounceTimers.set(file.path, timer);
  }

  private tryCapture(file: TFile): void {
    const settings = this.getSettings();
    const lastCapture = this.lastCaptureTime.get(file.path) ?? 0;
    const elapsed = Date.now() - lastCapture;

    if (elapsed >= settings.minIntervalMs) {
      // Enough time has passed, capture now
      this.captureChange(file);
    } else {
      // Too soon — schedule a deferred capture at the next eligible time
      const existingPending = this.pendingCapture.get(file.path);
      if (existingPending) clearTimeout(existingPending);

      const delay = settings.minIntervalMs - elapsed;
      const pendingTimer = setTimeout(() => {
        this.pendingCapture.delete(file.path);
        this.captureChange(file);
      }, delay);
      this.pendingCapture.set(file.path, pendingTimer);
    }
  }

  private async captureChange(file: TFile): Promise<void> {
    try {
      const currentContent = await this.vault.cachedRead(file);
      const snapshot = await this.storage.getSnapshot(file.path);

      if (snapshot) {
        if (snapshot.content === currentContent) return; // No actual change

        const patches = this.diffEngine.computePatch(
          snapshot.content,
          currentContent
        );
        const baseHash = this.diffEngine.computeHash(snapshot.content);
        const { added, removed } = this.diffEngine.computeLineDiff(
          snapshot.content,
          currentContent
        );
        await this.storage.saveDiff(file.path, patches, baseHash, added, removed);
        this.lastCaptureTime.set(file.path, Date.now());

        // Notify listeners
        this.onDiffSaved?.(file.path);
      } else {
        // First time seeing this file — create initial diff from empty string
        const patches = this.diffEngine.computePatch("", currentContent);
        const baseHash = this.diffEngine.computeHash("");
        const { added, removed } = this.diffEngine.computeLineDiff(
          "",
          currentContent
        );
        await this.storage.saveDiff(file.path, patches, baseHash, added, removed);
        this.lastCaptureTime.set(file.path, Date.now());
        this.onSnapshotCreated?.(file.path);
      }

      // Always update the snapshot to latest
      await this.storage.saveSnapshot(file.path, currentContent);
    } catch (e) {
      console.error("[diff-history] Failed to capture change:", e);
    }
  }
}
