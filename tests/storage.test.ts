import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StorageManager, DiffHistoryDB } from "../src/storage";

describe("StorageManager", () => {
  let db: DiffHistoryDB;
  let storage: StorageManager;

  beforeEach(() => {
    db = new DiffHistoryDB();
    storage = new StorageManager(db);
  });

  afterEach(async () => {
    await storage.close();
    await db.delete();
  });

  describe("saveDiff / getDiffs", () => {
    it("should save and retrieve diffs for a file", async () => {
      await storage.saveDiff("notes/test.md", "patch1", "hash1");
      await storage.saveDiff("notes/test.md", "patch2", "hash2");

      const diffs = await storage.getDiffs("notes/test.md");
      expect(diffs).toHaveLength(2);
      expect(diffs[0].patches).toBe("patch1");
      expect(diffs[1].patches).toBe("patch2");
    });

    it("should isolate diffs by file path", async () => {
      await storage.saveDiff("file-a.md", "patchA", "hashA");
      await storage.saveDiff("file-b.md", "patchB", "hashB");

      const diffsA = await storage.getDiffs("file-a.md");
      const diffsB = await storage.getDiffs("file-b.md");
      expect(diffsA).toHaveLength(1);
      expect(diffsB).toHaveLength(1);
      expect(diffsA[0].patches).toBe("patchA");
      expect(diffsB[0].patches).toBe("patchB");
    });

    it("should filter diffs by since timestamp", async () => {
      await storage.saveDiff("test.md", "old", "h1");
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      const midpoint = Date.now();
      await new Promise((r) => setTimeout(r, 10));
      await storage.saveDiff("test.md", "new", "h2");

      const recent = await storage.getDiffs("test.md", midpoint);
      expect(recent).toHaveLength(1);
      expect(recent[0].patches).toBe("new");
    });
  });

  describe("snapshots", () => {
    it("should save and retrieve a snapshot", async () => {
      await storage.saveSnapshot("test.md", "content here");
      const snap = await storage.getSnapshot("test.md");
      expect(snap).toBeDefined();
      expect(snap!.content).toBe("content here");
      expect(snap!.filePath).toBe("test.md");
    });

    it("should overwrite snapshot on re-save", async () => {
      await storage.saveSnapshot("test.md", "v1");
      await storage.saveSnapshot("test.md", "v2");
      const snap = await storage.getSnapshot("test.md");
      expect(snap!.content).toBe("v2");
    });

    it("should return undefined for missing snapshot", async () => {
      const snap = await storage.getSnapshot("nonexistent.md");
      expect(snap).toBeUndefined();
    });
  });

  describe("deleteBefore", () => {
    it("should delete old diffs", async () => {
      await storage.saveDiff("test.md", "old", "h1");
      await new Promise((r) => setTimeout(r, 10));
      const cutoff = Date.now();
      await new Promise((r) => setTimeout(r, 10));
      await storage.saveDiff("test.md", "new", "h2");

      const deleted = await storage.deleteBefore(cutoff);
      expect(deleted).toBe(1);

      const remaining = await storage.getDiffs("test.md");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].patches).toBe("new");
    });
  });

  describe("deleteByFile", () => {
    it("should delete all diffs and snapshot for a file", async () => {
      await storage.saveDiff("target.md", "p1", "h1");
      await storage.saveDiff("target.md", "p2", "h2");
      await storage.saveSnapshot("target.md", "content");
      await storage.saveDiff("other.md", "p3", "h3");

      const deleted = await storage.deleteByFile("target.md");
      expect(deleted).toBe(2);

      const diffs = await storage.getDiffs("target.md");
      expect(diffs).toHaveLength(0);
      const snap = await storage.getSnapshot("target.md");
      expect(snap).toBeUndefined();

      // Other file untouched
      const otherDiffs = await storage.getDiffs("other.md");
      expect(otherDiffs).toHaveLength(1);
    });
  });

  describe("deleteAll", () => {
    it("should clear everything", async () => {
      await storage.saveDiff("a.md", "p1", "h1");
      await storage.saveDiff("b.md", "p2", "h2");
      await storage.saveSnapshot("a.md", "content");

      await storage.deleteAll();

      const diffsA = await storage.getDiffs("a.md");
      const diffsB = await storage.getDiffs("b.md");
      expect(diffsA).toHaveLength(0);
      expect(diffsB).toHaveLength(0);
      const snap = await storage.getSnapshot("a.md");
      expect(snap).toBeUndefined();
    });
  });

  describe("renamePath", () => {
    it("should update filePath in diffs and snapshots", async () => {
      await storage.saveDiff("old-name.md", "p1", "h1");
      await storage.saveSnapshot("old-name.md", "content");

      await storage.renamePath("old-name.md", "new-name.md");

      const oldDiffs = await storage.getDiffs("old-name.md");
      expect(oldDiffs).toHaveLength(0);
      const oldSnap = await storage.getSnapshot("old-name.md");
      expect(oldSnap).toBeUndefined();

      const newDiffs = await storage.getDiffs("new-name.md");
      expect(newDiffs).toHaveLength(1);
      expect(newDiffs[0].patches).toBe("p1");
      const newSnap = await storage.getSnapshot("new-name.md");
      expect(newSnap).toBeDefined();
      expect(newSnap!.content).toBe("content");
    });
  });

  describe("getStorageEstimate", () => {
    it("should return count and oldest timestamp", async () => {
      await storage.saveDiff("a.md", "p1", "h1");
      await new Promise((r) => setTimeout(r, 10));
      await storage.saveDiff("b.md", "p2", "h2");

      const estimate = await storage.getStorageEstimate();
      expect(estimate.count).toBe(2);
      expect(estimate.oldest).toBeDefined();
      expect(estimate.oldest).toBeLessThanOrEqual(Date.now());
    });

    it("should return zero count when empty", async () => {
      const estimate = await storage.getStorageEstimate();
      expect(estimate.count).toBe(0);
      expect(estimate.oldest).toBeUndefined();
    });
  });
});
