import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

interface PatchObj {
  diffs: [number, string][];
  start1: number;
  start2: number;
  length1: number;
  length2: number;
}

export class DiffEngine {
  computePatch(oldText: string, newText: string): string {
    const patches = dmp.patch_make(oldText, newText);
    return dmp.patch_toText(patches);
  }

  applyPatch(text: string, patchStr: string): { text: string; ok: boolean } {
    const patches = dmp.patch_fromText(patchStr);
    const [result, applied] = dmp.patch_apply(patches, text);
    return { text: result, ok: applied.every(Boolean) };
  }

  applyPatchReverse(
    text: string,
    patchStr: string
  ): { text: string; ok: boolean } {
    const patches = dmp.patch_fromText(patchStr) as unknown as PatchObj[];
    // Reverse each patch: swap diffs' INSERT <-> DELETE
    for (const patch of patches) {
      for (const diff of patch.diffs) {
        if (diff[0] === DiffMatchPatch.DIFF_INSERT) {
          diff[0] = DiffMatchPatch.DIFF_DELETE;
        } else if (diff[0] === DiffMatchPatch.DIFF_DELETE) {
          diff[0] = DiffMatchPatch.DIFF_INSERT;
        }
      }
      // Swap lengths
      const tmp = patch.length1;
      patch.length1 = patch.length2;
      patch.length2 = tmp;
      // Swap start positions
      const tmpStart = patch.start1;
      patch.start1 = patch.start2;
      patch.start2 = tmpStart;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, applied] = dmp.patch_apply(patches as any, text);
    return { text: result, ok: applied.every(Boolean) };
  }

  computeHash(text: string): string {
    // Simple FNV-1a hash for integrity checking
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  computeLineDiff(
    oldText: string,
    newText: string
  ): { added: number; removed: number } {
    // Use line-level diff for git-consistent line counting
    const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(
      oldText,
      newText
    );
    const diffs = dmp.diff_main(chars1, chars2, false);
    dmp.diff_charsToLines_(diffs, lineArray);
    dmp.diff_cleanupSemantic(diffs);
    let added = 0;
    let removed = 0;
    for (const [op, text] of diffs) {
      const lines = (text.match(/\n/g) || []).length;
      if (op === DiffMatchPatch.DIFF_INSERT) {
        added += lines;
      } else if (op === DiffMatchPatch.DIFF_DELETE) {
        removed += lines;
      }
    }
    return { added, removed };
  }
}
