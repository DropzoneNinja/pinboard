export const EMPTY_NOTE_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function toEditorDoc(content: unknown): object {
  if (
    typeof content === 'object' &&
    content !== null &&
    (content as { type?: unknown }).type === 'doc'
  ) {
    return content as object;
  }
  return EMPTY_NOTE_DOC;
}
