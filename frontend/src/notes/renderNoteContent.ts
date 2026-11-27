import { generateHTML } from '@tiptap/core';
import { noteEditorExtensions } from '../editor/noteExtensions';
import { toEditorDoc } from './noteContent';

export function renderNoteContentHtml(content: unknown): string {
  try {
    return generateHTML(toEditorDoc(content), noteEditorExtensions);
  } catch {
    return '';
  }
}
