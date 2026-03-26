import { describe, it, expect } from "vitest";
import { DiffEngine } from "../src/diff-engine";

describe("DiffEngine", () => {
  const engine = new DiffEngine();

  describe("computePatch / applyPatch", () => {
    it("should compute and apply a patch", () => {
      const old = "Hello World";
      const next = "Hello Obsidian";
      const patch = engine.computePatch(old, next);
      expect(patch).toBeTruthy();

      const result = engine.applyPatch(old, patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe(next);
    });

    it("should handle empty to content", () => {
      const patch = engine.computePatch("", "New content");
      const result = engine.applyPatch("", patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe("New content");
    });

    it("should handle content to empty", () => {
      const patch = engine.computePatch("Some content", "");
      const result = engine.applyPatch("Some content", patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe("");
    });

    it("should handle multiline changes", () => {
      const old = "line1\nline2\nline3\nline4";
      const next = "line1\nmodified\nline3\nnew line\nline4";
      const patch = engine.computePatch(old, next);
      const result = engine.applyPatch(old, patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe(next);
    });

    it("should handle identical texts (no-op)", () => {
      const text = "No changes";
      const patch = engine.computePatch(text, text);
      // patch may be empty string for no changes
      const result = engine.applyPatch(text, patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe(text);
    });
  });

  describe("applyPatchReverse", () => {
    it("should reverse a patch to get original text", () => {
      const old = "Hello World";
      const next = "Hello Obsidian";
      const patch = engine.computePatch(old, next);

      const result = engine.applyPatchReverse(next, patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe(old);
    });

    it("should reverse multiline changes", () => {
      const old = "line1\nline2\nline3";
      const next = "line1\nchanged\nline3\nline4";
      const patch = engine.computePatch(old, next);

      const result = engine.applyPatchReverse(next, patch);
      expect(result.ok).toBe(true);
      expect(result.text).toBe(old);
    });
  });

  describe("computeHash", () => {
    it("should produce consistent hashes", () => {
      const hash1 = engine.computeHash("test");
      const hash2 = engine.computeHash("test");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different input", () => {
      const hash1 = engine.computeHash("text a");
      const hash2 = engine.computeHash("text b");
      expect(hash1).not.toBe(hash2);
    });

    it("should return 8 char hex string", () => {
      const hash = engine.computeHash("anything");
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("computeLineDiff", () => {
    it("should count added and removed lines", () => {
      const old = "line1\nline2\nline3";
      const next = "line1\nchanged\nline3\nline4";
      const diff = engine.computeLineDiff(old, next);
      expect(diff.added).toBeGreaterThan(0);
      expect(diff.removed).toBeGreaterThan(0);
    });

    it("should return zero for identical texts", () => {
      const text = "same\ncontent";
      const diff = engine.computeLineDiff(text, text);
      expect(diff.added).toBe(0);
      expect(diff.removed).toBe(0);
    });
  });
});
