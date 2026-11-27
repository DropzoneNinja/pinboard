/**
 * Client-side undo stack, scoped to actions the current user performed in this session. Never
 * includes changes that arrived over the socket from the other user, so undo can't reverse their
 * work (PROJECT.md §11 "Undo should not reverse unrelated changes made by the other user").
 */
export type UndoEntry =
  | { type: 'move'; noteId: string; prevX: number; prevY: number }
  | { type: 'resize'; noteId: string; prevWidth: number; prevHeight: number }
  | { type: 'colour'; noteId: string; prevColour: string }
  | { type: 'delete'; noteId: string }
  | { type: 'connect'; connectionId: string };

const MAX_UNDO_ENTRIES = 20;

export function createUndoStack() {
  const stack: UndoEntry[] = [];
  return {
    push(entry: UndoEntry) {
      stack.push(entry);
      if (stack.length > MAX_UNDO_ENTRIES) stack.shift();
    },
    pop(): UndoEntry | undefined {
      return stack.pop();
    },
  };
}
