import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type DiffHistoryPlugin from "./main";
import type { HistoryEntry } from "./history-manager";
import { ConfirmModal } from "./confirm-modal";
import { DiffCompareModal } from "./diff-view";
import { formatTime, formatDate, groupBy } from "./utils";

export const VIEW_TYPE_DIFF_HISTORY = "diff-history-view";

export class DiffHistoryView extends ItemView {
  private currentFile: string | null = null;
  private entries: HistoryEntry[] = [];

  constructor(leaf: WorkspaceLeaf, private plugin: DiffHistoryPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DIFF_HISTORY;
  }

  getDisplayText(): string {
    return "Diff History";
  }

  getIcon(): string {
    return "history";
  }

  async onOpen(): Promise<void> {
    this.renderEmpty();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  getCurrentFile(): string | null {
    return this.currentFile;
  }

  async showFileHistory(filePath: string): Promise<void> {
    this.currentFile = filePath;
    this.entries = await this.plugin.historyManager.getFileHistory(filePath);
    // Reverse to show newest first
    this.entries.reverse();
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const container = contentEl.createDiv({ cls: "diff-history-view" });

    if (!this.currentFile) {
      this.renderEmpty();
      return;
    }

    // File name header
    const header = container.createDiv({ cls: "diff-history-file-header" });
    const fileName = this.currentFile.split("/").pop() || this.currentFile;
    header.createEl("strong", { text: fileName });

    if (this.entries.length === 0) {
      this.renderEmpty();
      return;
    }

    // Group by date
    const groups = groupBy(this.entries, (e) =>
      formatDate(e.record.timestamp)
    );

    for (const [date, entries] of groups) {
      const group = container.createDiv({ cls: "diff-history-date-group" });
      group.createDiv({ cls: "diff-history-date-header", text: date });

      for (const entry of entries) {
        const row = group.createDiv({ cls: "diff-history-entry" });
        row.createSpan({
          cls: "diff-history-time",
          text: formatTime(entry.record.timestamp),
        });

        const summary = row.createSpan({ cls: "diff-history-summary" });
        if (entry.added > 0) {
          summary.createSpan({
            cls: "diff-history-additions",
            text: `+${entry.added}`,
          });
        }
        if (entry.removed > 0) {
          summary.createSpan({
            cls: "diff-history-deletions",
            text: `-${entry.removed}`,
          });
        }

        // Action buttons
        const actions = row.createSpan({ cls: "diff-history-entry-actions" });

        const diffBtn = actions.createEl("button", {
          cls: "diff-history-btn diff-history-btn-diff",
          text: "Diff",
        });
        diffBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const index = this.entries.indexOf(entry);
          this.onShowDiff(entry, index);
        });

        const restoreBtn = actions.createEl("button", {
          cls: "diff-history-btn diff-history-btn-restore",
          text: "Restore",
        });
        restoreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onRestore(entry);
        });
      }
    }
  }

  private renderEmpty(): void {
    const { contentEl } = this;
    contentEl.empty();
    const container = contentEl.createDiv({ cls: "diff-history-view" });
    container.createDiv({
      cls: "diff-history-empty",
      text: "No history available. Open a file and start editing to see changes here.",
    });
  }

  private async onShowDiff(entry: HistoryEntry, index: number): Promise<void> {
    if (!this.currentFile) return;

    const reconstructed = await this.plugin.historyManager.reconstructAtPoint(
      this.currentFile,
      entry.record.timestamp
    );

    if (reconstructed === null) {
      new Notice("Failed to reconstruct file at this point.");
      return;
    }

    let previousContent: string;
    let leftLabel: string;

    // Entries are sorted newest-first, so the chronologically previous entry is at index + 1
    const prevIndex = index + 1;
    if (prevIndex < this.entries.length) {
      const prevEntry = this.entries[prevIndex];
      const prev = await this.plugin.historyManager.reconstructAtPoint(
        this.currentFile,
        prevEntry.record.timestamp
      );
      if (prev === null) {
        new Notice("Failed to reconstruct previous state.");
        return;
      }
      previousContent = prev;
      leftLabel = `${formatDate(prevEntry.record.timestamp)} ${formatTime(prevEntry.record.timestamp)}`;
    } else {
      previousContent = "";
      leftLabel = "(empty)";
    }

    const time = formatTime(entry.record.timestamp);
    const date = formatDate(entry.record.timestamp);
    const rightLabel = `${date} ${time}`;

    new DiffCompareModal(
      this.plugin.app,
      previousContent,
      reconstructed,
      `${leftLabel} → ${rightLabel}`,
      leftLabel,
      rightLabel
    ).open();
  }

  private async onRestore(entry: HistoryEntry): Promise<void> {
    if (!this.currentFile) return;

    const time = formatTime(entry.record.timestamp);
    const date = formatDate(entry.record.timestamp);

    const confirmed = await new ConfirmModal(
      this.plugin.app,
      "Restore file",
      `Restore to ${date} ${time}? A new history entry will be created for the current state.`
    ).waitForResult();

    if (!confirmed) return;

    const success = await this.plugin.historyManager.restoreToPoint(
      this.currentFile,
      entry.record.timestamp
    );

    if (success) {
      new Notice("File restored successfully.");
      await this.showFileHistory(this.currentFile);
    } else {
      new Notice("Failed to restore file.");
    }
  }
}
