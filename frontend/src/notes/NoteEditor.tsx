import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useNote } from './useNote';
import { noteEditorExtensions } from '../editor/noteExtensions';
import { EditorToolbar } from '../editor/EditorToolbar';
import { Lightbox } from '../editor/Lightbox';
import { ActivityHistory } from './ActivityHistory';
import { NOTE_COLOURS } from './palette';
import { EMPTY_NOTE_DOC, toEditorDoc } from './noteContent';
import { apiFetch, ApiError, uploadFile } from '../services/api';
import { formatDateTime } from '../services/formatDate';
import { useAppSettings } from '../contexts/AppSettingsContext';
import type { UndoEntry } from '../boards/undo';
import type { Attachment, Note } from '../services/types';

// Keep in sync with the backend's ALLOWED_UPLOAD_MIME_TYPES (notes/routes.ts).
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  noteId: string;
  patchNote: (noteId: string, version: number, fields: Partial<Note>) => Promise<Note | undefined>;
  onClose: () => void;
  onArchived: () => void;
  onDeleted: () => void;
  onDuplicated: (note: Note) => void;
  registerUndo: (entry: UndoEntry) => void;
}

export function NoteEditor({
  noteId,
  patchNote,
  onClose,
  onArchived,
  onDeleted,
  onDuplicated,
  registerUndo,
}: NoteEditorProps) {
  const { note, loading } = useNote(noteId);
  const { settings } = useAppSettings();

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState(1);
  const [backgroundColour, setBackgroundColour] = useState('yellow');
  const [meta, setMeta] = useState<{
    createdAt: string;
    updatedAt: string;
    creator: Note['creator'];
    updater: Note['updater'];
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [conflictNote, setConflictNote] = useState<Note | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'archive' | 'delete' | 'duplicate' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: noteEditorExtensions,
    content: EMPTY_NOTE_DOC,
    onUpdate: () => scheduleSave(),
    // Without this, tiptap only re-renders NoteEditor (and so EditorToolbar's active-state
    // checks, like "is the cursor inside a table") on content changes, not on plain cursor
    // movement — so clicking into an existing table never refreshed the toolbar.
    shouldRerenderOnTransaction: true,
  });

  const doSave = useCallback(() => {
    if (!editor) return;
    pendingRef.current = false;
    setSaveStatus('saving');
    patchNote(noteId, version, {
      title: title.trim() || 'Untitled note',
      content: editor.getJSON(),
    })
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
    saveTimeoutRef.current = setTimeout(doSave, settings.autosaveDebounceMs);
  }, [doSave, settings.autosaveDebounceMs]);

  useEffect(() => {
    if (note && editor && !initializedRef.current) {
      initializedRef.current = true;
      setTitle(note.title);
      setVersion(note.version);
      setBackgroundColour(note.backgroundColour);
      setMeta({
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        creator: note.creator,
        updater: note.updater,
      });
      editor.commands.setContent(toEditorDoc(note.content), { emitUpdate: false });
    }
  }, [note, editor]);

  function handleColourChange(colour: string) {
    const prevColour = backgroundColour;
    if (colour === prevColour) return;
    setBackgroundColour(colour);
    patchNote(noteId, version, { backgroundColour: colour })
      .then((updated) => {
        if (updated) setVersion(updated.version);
        registerUndo({ type: 'colour', noteId, prevColour });
      })
      .catch(() => setBackgroundColour(prevColour));
  }

  async function handleArchive() {
    setBusyAction('archive');
    try {
      await apiFetch(`/notes/${noteId}/archive`, { method: 'POST' });
      onArchived();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${title.trim() || 'Untitled note'}"? It will move to the recycle bin.`,
      )
    )
      return;
    setBusyAction('delete');
    try {
      await apiFetch(`/notes/${noteId}`, { method: 'DELETE' });
      registerUndo({ type: 'delete', noteId });
      onDeleted();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDuplicate() {
    setBusyAction('duplicate');
    try {
      const { note: duplicate } = await apiFetch<{ note: Note }>(`/notes/${noteId}/duplicate`, {
        method: 'POST',
      });
      onDuplicated(duplicate);
    } finally {
      setBusyAction(null);
    }
  }

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

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return;
    // Required so the browser treats this as a valid drop target instead of its default action
    // (which, for a dropped file, is to navigate to/open it — e.g. in a new tab).
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!editor) return;
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ALLOWED_IMAGE_MIME_TYPES.has(f.type),
    );
    if (files.length === 0) {
      if (e.dataTransfer.files.length > 0) {
        window.alert('Only JPG, PNG, WebP and GIF images can be dropped into a note.');
      }
      return;
    }

    // Drop the first image where the cursor actually landed; the rest follow it in order,
    // the same way they would if picked one-by-one from the toolbar's file picker.
    const dropPos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
    if (dropPos !== undefined) {
      editor.commands.setTextSelection(dropPos);
    }
    for (const file of files) {
      await handleUploadImage(file);
    }
  }

  function handleReloadLatest() {
    if (!conflictNote || !editor) return;
    setTitle(conflictNote.title);
    setVersion(conflictNote.version);
    setBackgroundColour(conflictNote.backgroundColour);
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

  // A drop anywhere in the modal other than the content area (e.g. the title bar, or the
  // backdrop) should still never fall through to the browser's default "open this file" action.
  function preventDefaultFileDrag(e: DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  }

  return (
    <div
      className="note-editor-overlay"
      onDragOver={preventDefaultFileDrag}
      onDrop={preventDefaultFileDrag}
    >
      <div className="note-editor" onClick={(e) => e.stopPropagation()}>
        <div className="note-editor__header">
          <input
            className="note-editor__title"
            value={title}
            maxLength={150}
            placeholder="Untitled note"
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <button
            type="button"
            className="note-editor__action-btn"
            title="Duplicate note"
            disabled={busyAction !== null}
            onClick={handleDuplicate}
          >
            ⧉
          </button>
          <button
            type="button"
            className="note-editor__action-btn"
            title="Archive note"
            disabled={busyAction !== null}
            onClick={handleArchive}
          >
            🗄
          </button>
          <button
            type="button"
            className="note-editor__action-btn"
            title="Delete note"
            disabled={busyAction !== null}
            onClick={handleDelete}
          >
            🗑
          </button>
          <button className="modal-card__close" onClick={flushAndClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="note-editor__colours">
          {Object.entries(NOTE_COLOURS).map(([name, hex]) => (
            <button
              key={name}
              type="button"
              className="note-editor__colour-swatch"
              style={{
                background: hex,
                outline: backgroundColour === name ? '2px solid var(--colour-primary)' : undefined,
              }}
              title={name}
              onClick={() => handleColourChange(name)}
            />
          ))}
        </div>

        {meta && (
          <div className="note-editor__meta">
            <span>
              Created by <strong>{meta.creator.displayName}</strong> on{' '}
              {formatDateTime(meta.createdAt, settings.dateTimeFormat)}
            </span>
            <span>
              · Last updated by <strong>{meta.updater.displayName}</strong>{' '}
              {formatDateTime(meta.updatedAt, settings.dateTimeFormat)}
            </span>
            <button
              className="note-editor__history-toggle"
              onClick={() => setShowHistory((s) => !s)}
            >
              · {showHistory ? 'Hide history' : 'History'}
            </button>
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

        {showHistory && (
          <ActivityHistory noteId={noteId} dateTimeFormat={settings.dateTimeFormat} />
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

        <div
          className={`note-editor__content${isDragOver ? ' note-editor__content--drag-over' : ''}`}
          ref={contentRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <p className="full-page-status">Loading…</p>
          ) : (
            <EditorContent editor={editor} />
          )}
          {isDragOver && <div className="note-editor__drop-hint">Drop image to add it</div>}
        </div>
      </div>
      {lightboxSrc && <Lightbox src={lightboxSrc} alt="" onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
