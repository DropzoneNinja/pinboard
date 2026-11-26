import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import { useNote } from './useNote';
import { ResizableImage } from '../editor/ResizableImage';
import { TableCellWithBackground, TableHeaderWithBackground } from '../editor/tableExtensions';
import { EditorToolbar } from '../editor/EditorToolbar';
import { Lightbox } from '../editor/Lightbox';
import { ApiError, uploadFile } from '../services/api';
import { formatDateTime } from '../services/formatDate';
import type { Attachment, Note } from '../services/types';

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

function toEditorDoc(content: unknown): object {
  if (typeof content === 'object' && content !== null && (content as { type?: unknown }).type === 'doc') {
    return content as object;
  }
  return EMPTY_DOC;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  noteId: string;
  patchNote: (noteId: string, version: number, fields: Partial<Note>) => Promise<Note | undefined>;
  onClose: () => void;
}

export function NoteEditor({ noteId, patchNote, onClose }: NoteEditorProps) {
  const { note, loading } = useNote(noteId);

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState(1);
  const [meta, setMeta] = useState<{
    createdAt: string;
    updatedAt: string;
    creator: Note['creator'];
    updater: Note['updater'];
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [conflictNote, setConflictNote] = useState<Note | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
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
    ],
    content: EMPTY_DOC,
    onUpdate: () => scheduleSave(),
  });

  const doSave = useCallback(() => {
    if (!editor) return;
    pendingRef.current = false;
    setSaveStatus('saving');
    patchNote(noteId, version, { title: title.trim() || 'Untitled note', content: editor.getJSON() })
      .then((updated) => {
        if (updated) {
          setVersion(updated.version);
          setMeta({
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            creator: updated.creator,
            updater: updated.updater,
          });
        }
        setSaveStatus('saved');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 409) {
          const latest = (err.body as { note?: Note } | undefined)?.note;
          if (latest) {
            setVersion(latest.version);
            setConflictNote(latest);
          }
        }
        setSaveStatus('error');
      });
  }, [editor, noteId, patchNote, title, version]);

  const scheduleSave = useCallback(() => {
    pendingRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, 700);
  }, [doSave]);

  useEffect(() => {
    if (note && editor && !initializedRef.current) {
      initializedRef.current = true;
      setTitle(note.title);
      setVersion(note.version);
      setMeta({
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        creator: note.creator,
        updater: note.updater,
      });
      editor.commands.setContent(toEditorDoc(note.content), { emitUpdate: false });
    }
  }, [note, editor]);

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave();
  }

  function flushAndClose() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (pendingRef.current) doSave();
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        flushAndClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, version]);

  async function handleUploadImage(file: File) {
    if (!editor) return;
    try {
      const { attachment } = await uploadFile<{ attachment: Attachment }>(
        `/notes/${noteId}/attachments`,
        file,
      );
      editor
        .chain()
        .focus()
        .setImage({ src: `/api/v1/attachments/${attachment.id}`, alt: attachment.originalFilename })
        .run();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Could not upload that image.');
    }
  }

  function handleReloadLatest() {
    if (!conflictNote || !editor) return;
    setTitle(conflictNote.title);
    setVersion(conflictNote.version);
    setMeta({
      createdAt: conflictNote.createdAt,
      updatedAt: conflictNote.updatedAt,
      creator: conflictNote.creator,
      updater: conflictNote.updater,
    });
    editor.commands.setContent(toEditorDoc(conflictNote.content), { emitUpdate: false });
    setConflictNote(null);
    setSaveStatus('saved');
  }

  function handleKeepMine() {
    setConflictNote(null);
    doSave();
  }

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    function handleClick(e: Event) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        setLightboxSrc((target as HTMLImageElement).src);
      }
    }
    content.addEventListener('click', handleClick);
    return () => content.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="note-editor-overlay">
      <div className="note-editor" onClick={(e) => e.stopPropagation()}>
        <div className="note-editor__header">
          <input
            className="note-editor__title"
            value={title}
            maxLength={150}
            placeholder="Untitled note"
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <button className="modal-card__close" onClick={flushAndClose} aria-label="Close">
            ×
          </button>
        </div>

        {meta && (
          <div className="note-editor__meta">
            <span>
              Created by <strong>{meta.creator.displayName}</strong> on {formatDateTime(meta.createdAt)}
            </span>
            <span>
              · Last updated by <strong>{meta.updater.displayName}</strong> {formatDateTime(meta.updatedAt)}
            </span>
            <span className={`save-status save-status--${saveStatus}`}>
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'error' && (
                <>
                  Unable to save —{' '}
                  <button className="save-status__retry" onClick={doSave}>
                    Retry
                  </button>
                </>
              )}
            </span>
          </div>
        )}

        {conflictNote && (
          <div className="note-editor__conflict">
            This note was changed elsewhere while you were editing.
            <button className="btn" onClick={handleReloadLatest}>
              Reload latest
            </button>
            <button className="btn btn--primary" onClick={handleKeepMine}>
              Keep my changes
            </button>
          </div>
        )}

        <EditorToolbar editor={editor} onUploadImage={handleUploadImage} />

        <div className="note-editor__content" ref={contentRef}>
          {loading ? <p className="full-page-status">Loading…</p> : <EditorContent editor={editor} />}
        </div>
      </div>
      {lightboxSrc && <Lightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
