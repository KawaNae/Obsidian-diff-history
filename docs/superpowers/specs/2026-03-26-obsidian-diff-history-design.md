# obsidian-diff-history Design Spec

## Context

Obsidianで編集中のノートの差分を一定期間保存し、誤編集の復元とバックアップを提供するプラグイン。モバイル（iOS/Android）でも動作することが必須要件。Gitを使わないユーザーでもファイルの変更履歴を辿れるようにする。

## Requirements

- `vault.on('modify')` で変更を検知し、差分を自動保存する
- モバイル（Obsidian Mobile）で完全に動作すること
- ユーザーが設定した保存期間に基づいて古い差分を自動削除
- エディタ上でGit風のdiffビューを提供
- パフォーマンスに影響を与えないこと

## Architecture

```
┌─────────────────────────────────────────┐
│            Obsidian Plugin              │
│                                         │
│  ┌──────────┐    ┌──────────────────┐  │
│  │ Event    │───>│ DiffEngine       │  │
│  │ Listener │    │ (diff-match-patch)│  │
│  └──────────┘    └────────┬─────────┘  │
│                           │             │
│                  ┌────────v─────────┐  │
│                  │ StorageManager   │  │
│                  │ (IndexedDB/Dexie)│  │
│                  └────────┬─────────┘  │
│                           │             │
│  ┌──────────┐    ┌────────v─────────┐  │
│  │ DiffView │<───│ HistoryManager   │  │
│  │ (CM6     │    │ (検索・復元・    │  │
│  │  Deco)   │    │  期限切れ削除)   │  │
│  └──────────┘    └──────────────────┘  │
└─────────────────────────────────────────┘
```

### Components

1. **EventListener** — `vault.on('modify')` で変更検知。デバウンス（デフォルト2秒）で連続編集を1つの差分にまとめる。
2. **DiffEngine** — `diff-match-patch`で前回の内容との差分（パッチ）を計算。
3. **StorageManager** — Dexie.jsでIndexedDBへの読み書きを抽象化。モバイル・デスクトップ共通。
4. **HistoryManager** — 差分の検索、過去状態の再構築、復元、期限切れデータの自動削除を管理。
5. **DiffView** — CodeMirror 6のDecorationで追加行（緑）/削除行（赤）をハイライト表示。

## Data Model

### IndexedDB Schema (via Dexie.js)

```typescript
// Database: "obsidian-diff-history"

interface DiffRecord {
  id: string;            // auto-generated UUID
  filePath: string;      // vault内の相対パス
  timestamp: number;     // Date.now()
  patches: string;       // diff-match-patchのパッチテキスト（シリアライズ済み）
  baseHash: string;      // 変更前テキストのハッシュ（整合性検証用）
}

interface FileSnapshot {
  filePath: string;      // Primary Key
  content: string;       // 最新の既知コンテンツ（差分計算の基準）
  lastModified: number;
}
```

**Indexes:**
- `DiffRecord`: `[filePath+timestamp]` 複合インデックス
- `FileSnapshot`: `filePath` がPK

**Storage estimates:**
- 1パッチ: 数百バイト〜数KB
- 1000編集/日: 約1-5MB/日
- 30日保存: 150MB以下

## UI Design

### Commands (Command Palette)
- `Diff History: Show file history` — 現在のファイルの差分履歴を開く
- `Diff History: Restore to point` — 選択した時点に復元
- `Diff History: Clear history` — 履歴を削除

### History View (Sidebar Leaf)
- 日付ごとにグループ化したタイムライン表示
- 各エントリに変更行数のサマリー（+N -M lines）
- エントリ選択で差分プレビュー

### Diff Preview (Editor)
- CodeMirror 6 Decorationで追加行を緑、削除行を赤でハイライト
- Git unified diff風の表示
- 「この時点に復元」ボタン

### Restore Flow
1. タイムラインから時点を選択
2. パッチを逆順適用して過去の状態を再構築
3. プレビュー表示（現在 vs 復元先）
4. 確認ダイアログ → 承認で `vault.modify()` で書き戻し
5. 復元操作自体も新しい差分レコードとして記録

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Retention period | 7 days | 差分レコードの保持期間 |
| Debounce interval | 2 seconds | 連続編集をまとめる間隔 |
| Exclude patterns | (empty) | 履歴を記録しないファイル/フォルダ（glob形式） |
| Max storage | 200MB | IndexedDBの使用上限 |

## Error Handling

- **IndexedDB容量超過**: 最も古いレコードから自動削除 + Notice通知
- **差分適用失敗**: baseHashで整合性チェック。不整合時はFileSnapshotから再構築
- **ファイルリネーム/移動**: `vault.on('rename')` でDiffRecordのfilePathを更新

## Mobile Considerations

- IndexedDBはiOS/Android両方のObsidian Mobileで利用可能
- Node.js APIは使用しない（モバイル非対応のため）
- サイドバーはモバイルUIで自動的にドロワーとして表示される
- タッチフレンドリーなUI設計（十分なタップ領域）

## Technology Stack

- **Language**: TypeScript
- **Build**: esbuild (Obsidian plugin standard)
- **Diff library**: diff-match-patch
- **DB wrapper**: Dexie.js
- **Testing**: vitest

## Verification

1. デスクトップでファイル編集 → IndexedDBに差分が保存されることを確認
2. 履歴ビューでタイムラインが表示されることを確認
3. 差分プレビューでハイライトが正しく表示されることを確認
4. 復元フローが正しく動作することを確認
5. モバイルで同等の動作を確認
6. 保存期間超過後にレコードが自動削除されることを確認
7. ファイルリネーム後も履歴が追従することを確認
