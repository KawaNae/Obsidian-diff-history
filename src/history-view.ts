import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type DiffHistoryPlugin from "./main";
import type { HistoryEntry } from "./history-manager";
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

  async showFileHistory(filePath: string): Promise<void> {
    this.currentFile = filePath;
    this.entries = await this.plugin.historyManager.getFileHistory(filePath);
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const container = contentEl.createDiv({ cls: "diff-history-view" });

    if (!this.currentFile || this.entries.length === 0) {
      this.renderEmpty();
      return;
    }

    // File name header
    const header = container.createDiv({ cls: "diff-history-file-header" });
    const fileName = this.currentFile.split("/").pop() || this.currentFile;
    header.createEl("strong", { text: fileName });

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

        row.addEventListener("click", () => {
          this.onEntryClick(entry);
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

  private async onEntryClick(entry: HistoryEntry): Promise<void> {
    if (!this.currentFile) return;

    const reconstructed = await this.plugin.historyManager.reconstructAtPoint(
      this.currentFile,
      entry.record.timestamp
    );

    if (reconstructed === null) {
      new Notice("Failed to reconstruct file at this point.");
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.confirmRestore(entry);
    if (!confirmed) return;

    const success = await this.plugin.historyManager.restoreToPoint(
      this.currentFile,
      entry.record.timestamp
    );

    if (success) {
      new Notice("File restored successfully.");
      // Refresh the history view
      await this.showFileHistory(this.currentFile);
    } else {
      new Notice("Failed to restore file.");
    }
  }

  private confirmRestore(entry: HistoryEntry): Promise<boolean> {
    return new Promise((resolve) => {
      const time = formatTime(entry.record.timestamp);
      const date = formatDate(entry.record.timestamp);
      const msg = `Restore file to ${date} ${time}?\nThis will create a new entry in the history.`;

      if (confirm(msg)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }
}
