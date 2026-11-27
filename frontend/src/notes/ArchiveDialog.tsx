import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../services/api';
import { contentTypeIcon } from './contentTypeIcon';
import { formatShortDate } from '../services/formatDate';
import type { Note } from '../services/types';

interface ArchiveDialogProps {
  boardId: string;
  onClose: () => void;
  onRestored: (note: Note) => void;
}

export function ArchiveDialog({ boardId, onClose, onRestored }: ArchiveDialogProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ notes: Note[] }>(`/boards/${boardId}/notes?archived=true`)
      .then(({ notes }) => setNotes(notes))
      .finally(() => setLoading(false));
  }, [boardId]);

  async function handleRestore(noteId: string) {
    setRestoringId(noteId);
    try {
      const { note } = await apiFetch<{ note: Note }>(`/notes/${noteId}/restore`, {
        method: 'POST',
      });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      onRestored(note);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Modal title="Archived notes" onClose={onClose}>
      {loading && <p className="full-page-status">Loading…</p>}
      {!loading && notes.length === 0 && (
        <p className="search-dialog__status">No archived notes on this board.</p>
      )}
      <ul className="search-dialog__list">
        {notes.map((note) => (
          <li key={note.id} className="archive-dialog__row">
            <span className="search-dialog__icon">{contentTypeIcon(note.contentType)}</span>
            <span className="search-dialog__title">{note.title}</span>
            <span className="search-dialog__board">archived {formatShortDate(note.updatedAt)}</span>
            <button
              className="btn"
              disabled={restoringId === note.id}
              onClick={() => handleRestore(note.id)}
            >
              {restoringId === note.id ? 'Restoring…' : 'Restore'}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
