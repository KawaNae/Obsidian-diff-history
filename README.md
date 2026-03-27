# Diff History

> [日本語版はこちら](README.ja.md)

Automatically saves file diffs over time. Restore previous versions with a Git-like diff viewer. Works on mobile.

## Features

- **Automatic diff tracking** — Diffs are saved automatically as you edit markdown files. Only the changes (patches) are stored, keeping storage efficient.
- **History sidebar** — View all changes grouped by date with timestamps and line change statistics (+added / -removed).
- **Side-by-side diff viewer** — Compare consecutive snapshots with color-coded additions and deletions, synchronized scrolling, and line numbers.
- **One-click restore** — Restore any file to a previous state. The current state is preserved as a new history entry before restoring.
- **File context menu** — Right-click any markdown file to open its diff history.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Retention period | 7 days | How long to keep history before auto-deletion |
| Debounce interval | 5 seconds | Wait time after last edit before saving a diff |
| Minimum interval | 60 seconds | Minimum time between consecutive saves for the same file |
| Exclude patterns | (none) | Glob patterns for files/folders to exclude (e.g. `templates/**`) |
| Max storage | 200 MB | Maximum IndexedDB storage usage |

## Commands

- **Show file history** — Open the history sidebar for the active file
- **Restore to point** — Restore the active file to a previous state
- **Clear current file history** — Delete all history for the active file

## How it works

1. When you edit a markdown file, changes are detected and debounced
2. After the debounce period, a diff (patch) is computed against the last saved state and stored in IndexedDB
3. The first capture for a file creates an initial entry (equivalent to git's initial commit)
4. The history sidebar shows all entries with accurate line-level change counts (git-consistent)
5. Clicking "Diff" shows the changes between consecutive snapshots
6. Clicking "Restore" reconstructs the file at that point and writes it back
7. Old entries are automatically cleaned up based on retention period and storage limits

## Technical details

- Storage: IndexedDB via [Dexie](https://dexie.org/)
- Diff algorithm: [diff-match-patch](https://github.com/google/diff-match-patch)
- Line counting uses line-level diffs (consistent with git)
- File reconstruction works by reverse-applying patches from the latest snapshot

## License

MIT
