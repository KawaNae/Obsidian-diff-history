# obsidian-diff-history 開発ログ

## プロジェクト概要

Obsidianプラグインとして、ファイル編集の差分をIndexedDBに一定期間保存し、誤編集の復元とバックアップを提供する。モバイル（iOS/Android）でも動作。

- **リポジトリ**: https://github.com/KawaNae/Obsidian-diff-history
- **開発開始**: 2026-03-26
- **最新リリース**: v0.1.1

---

## v0.1.0 — 初回リリース (2026-03-26)

### ac23bea — Initial project scaffolding

プロジェクトの雛形を作成。既存プラグイン（obsidian-task-viewer, obsidian-wasm-image）のパターンを参考にした。

- `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`
- エントリポイント `src/main.ts`（空のPlugin class）
- 型定義 `src/types.ts`（DiffRecord, FileSnapshot, DiffHistorySettings）
- 基本CSS `src/styles.css`
- 依存: diff-match-patch, dexie, vitest, fake-indexeddb

### e00aaac — Implement core diff history plugin

全コア機能を実装。テスト24件全通過。

**アーキテクチャ:**
```
EventListener → DiffEngine → StorageManager → IndexedDB
                                  ↓
HistoryView ← HistoryManager ← StorageManager
```

**実装ファイル:**
- `src/storage.ts` — Dexie.jsでIndexedDB管理（DiffRecord/FileSnapshotテーブル）
- `src/diff-engine.ts` — diff-match-patchラッパー（パッチ計算/適用/逆適用/ハッシュ）
- `src/event-listener.ts` — `vault.on('modify')` で変更検知、デバウンス付き
- `src/history-manager.ts` — 差分履歴の検索、過去状態の再構築、復元、期限切れ削除
- `src/settings.ts` — PluginSettingTab（保存期間、デバウンス、除外パターン、最大ストレージ）
- `src/history-view.ts` — サイドバーItemView（タイムライン表示、日付グループ化）
- `src/diff-view.ts` — CM6 ViewPluginでインラインdiffハイライト（後にモーダルに置き換え）
- `src/utils.ts` — minimatch, formatTime, formatDate, groupBy

**設計判断:**
- ストレージ: IndexedDB（パフォーマンス重視、同期サービスに影響なし、モバイル対応）
- 差分方式: diff-match-patchによるパッチ保存（スナップショット全文保存より効率的）
- Node.js API不使用（モバイル互換性のため）

### 1de2670 — Fix restore freeze and add side-by-side diff view

ユーザーテストで発見された2つの問題を修正。

**問題1: リストア後にエディタがフリーズ**
- 原因: `window.confirm()` がObsidianのエディタのフォーカス/イベントループをブロック
- 修正: `confirm()` → ObsidianのModal (`ConfirmModal`) に置き換え
- 追加: リストア中はEventListenerを一時停止（`pause/resume`）して再帰的な差分キャプチャを防止
- 追加: リストア後にスナップショットを即座に更新

**問題2: Diffビューが貧弱**
- ユーザー要望: 「エディタ上で左右に分けて差分を比較するみたいなこと」
- 修正: CM6インラインデコレーション → `DiffCompareModal`（左右分割比較モーダル）
- 行単位diff、追加行(緑)/削除行(赤)/プレースホルダー表示
- スクロール同期付き
- 各エントリに「Diff」「Restore」の2ボタン配置

**新規ファイル:**
- `src/confirm-modal.ts` — 復元確認用Obsidian Modal
- `src/diff-view.ts` — 完全書き換え（DiffCompareModal）

### 5052729 — Improve capture interval, real-time updates, and UI

3つのUX改善。

**キャプチャ間隔の改善:**
- デバウンス: 2秒 → 5秒（入力停止検知）
- 最小間隔: 新規追加、デフォルト60秒（同一ファイルの連続保存を抑制）
- `minIntervalMs` を設定に追加、Settings UIにスライダー追加

**リアルタイムサイドバー更新:**
- `EventListener.onDiffSaved` コールバック追加
- 差分保存時にサイドバーを自動更新
- `workspace.on('active-leaf-change')` でアクティブファイル切り替え時に履歴も自動切り替え

**UI改善:**
- リボンアイコン（historyアイコン）追加
- 履歴を新しい順（降順）に表示

### f5ee994 — Show snapshot timestamp and "Current" as diff panel labels

Diff比較モーダルのパネルヘッダーを改善。

- 「Before」「After」→ スナップショット時刻（例: "Mar 27, 2026 01:20"）と「Current」に変更
- `DiffCompareModal` に `leftLabel` / `rightLabel` パラメータを追加

---

## v0.1.1 (2026-03-27)

### 076f614 — v0.1.1 リリース内容

**初回編集のフィードバック改善:**
- 問題: ファイルを初めて編集しても「No history available」のままで不安
- 修正: 初回スナップショット作成時に「Tracking started at HH:MM / Changes will appear here after the next edit.」を表示
- `EventListener.onSnapshotCreated` コールバック追加
- `HistoryManager.getSnapshot()` を公開
- `DiffHistoryView` でスナップショットの有無に応じた表示分岐

**コンテキストメニュー対応:**
- mdファイルの右上 ⋮ メニューに「Show diff history」を追加
- `workspace.on('file-menu')` でメニュー項目を登録

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| ビルド | esbuild |
| 差分計算 | diff-match-patch |
| DB | Dexie.js (IndexedDB) |
| テスト | vitest + fake-indexeddb |
| UI | Obsidian API (ItemView, Modal, Setting) |
| Diffビュー | カスタムHTML (左右分割) |

## ブランチ戦略

- `main` — リリースブランチ（タグ付き）
- `develop` — 開発ブランチ（通常の作業場所）
