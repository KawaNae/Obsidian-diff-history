import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import DiffMatchPatch from "diff-match-patch";

const dmp = new DiffMatchPatch();

const addedLineDeco = Decoration.line({ class: "diff-history-added-line" });
const removedLineDeco = Decoration.line({
  class: "diff-history-removed-line",
});

interface DiffState {
  oldText: string | null;
}

const diffState: DiffState = { oldText: null };

export function setDiffCompareText(text: string | null): void {
  diffState.oldText = text;
}

function buildDecorations(view: EditorView): DecorationSet {
  if (!diffState.oldText) return Decoration.none;

  const currentText = view.state.doc.toString();
  const diffs = dmp.diff_main(diffState.oldText, currentText);
  dmp.diff_cleanupSemantic(diffs);

  const builder = new RangeSetBuilder<Decoration>();
  let pos = 0;

  for (const [op, text] of diffs) {
    if (op === DiffMatchPatch.DIFF_EQUAL) {
      pos += text.length;
    } else if (op === DiffMatchPatch.DIFF_INSERT) {
      // Mark each line that contains inserted text
      const startLine = view.state.doc.lineAt(pos);
      const endPos = Math.min(pos + text.length, view.state.doc.length);
      const endLine = view.state.doc.lineAt(endPos);

      for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
        const line = view.state.doc.line(lineNum);
        builder.add(line.from, line.from, addedLineDeco);
      }
      pos += text.length;
    }
    // DIFF_DELETE: text doesn't exist in current doc, skip (no pos advance)
  }

  return builder.finish();
}

export const diffHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
