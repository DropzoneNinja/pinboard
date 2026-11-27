import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { ResizableImage } from './ResizableImage';
import { TableCellWithBackground, TableHeaderWithBackground } from './tableExtensions';

// Shared between the live editor (NoteEditor) and the read-only board preview
// (NotePreview), so both always render a note's content with the same schema.
export const noteEditorExtensions = [
  StarterKit,
  Underline,
  Link.configure({ openOnClick: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ResizableImage,
  Table.configure({ resizable: true }),
  TableRow,
  TableCellWithBackground,
  TableHeaderWithBackground,
];
