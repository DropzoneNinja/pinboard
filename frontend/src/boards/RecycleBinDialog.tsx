import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { apiFetch } from '../services/api';
import { formatShortDate } from '../services/formatDate';
import type { RecycleBinBoard, RecycleBinNote } from '../services/types';

interface RecycleBinDialogProps {
  onClose: () => void;
}

export function RecycleBinDialog({ onClose }: RecycleBinDialogProps) {
  const [boards, setBoards] = useState<RecycleBinBoard[]>([]);
  const [notes, setNotes] = useState<RecycleBinNote[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    apiFetch<{ boards: RecycleBinBoard[]; notes: RecycleBinNote[]; retentionDays: number }>(
      '/recycle-bin',
    )
      .then((data) => {
        setBoards(data.boards);
        setNotes(data.notes);
        setRetentionDays(data.retentionDays);
      })
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  async function handleRestore(id: string, type: 'note' | 'board') {
    setBusyId(id);
    try {
      await apiFetch(`/recycle-bin/${id}/restore?type=${type}`, { method: 'POST' });
      if (type === 'board') setBoards((prev) => prev.filter((b) => b.id !== id));
      else setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePermanentDelete(id: string, type: 'note' | 'board', label: string) {
    const kind = type === 'board' ? 'board and all its notes' : 'note';
    if (!window.confirm(`Permanently delete "${label}"? This ${kind} cannot be recovered.`)) return;
    setBusyId(id);
    try {
      await apiFetch(`/recycle-bin/${id}?type=${type}`, { method: 'DELETE' });
      if (type === 'board') setBoards((prev) => prev.filter((b) => b.id !== id));
      else setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal title="Recycle bin" onClose={onClose}>
      <p className="search-dialog__status">
        Items are kept for {retentionDays} days before being purged.
      </p>
      {loading && <p className="full-page-status">Loading…</p>}
      {!loading && boards.length === 0 && notes.length === 0 && (
        <p className="search-dialog__status">The recycle bin is empty.</p>
      )}
      {boards.length > 0 && (
        <div className="search-dialog__section">
          <h3>Boards</h3>
          <ul className="search-dialog__list">
            {boards.map((b) => (
              <li key={b.id} className="archive-dialog__row">
                <span className="search-dialog__title">{b.name}</span>
                <span className="search-dialog__board">expires {formatShortDate(b.expiresAt)}</span>
                <button
                  className="btn"
                  disabled={busyId === b.id}
                  onClick={() => handleRestore(b.id, 'board')}
                >
                  Restore
                </button>
                <button
                  className="btn recycle-bin__delete"
                  disabled={busyId === b.id}
                  onClick={() => handlePermanentDelete(b.id, 'board', b.name)}
                >
                  Delete forever
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="search-dialog__section">
          <h3>Notes</h3>
          <ul className="search-dialog__list">
            {notes.map((n) => (
              <li key={n.id} className="archive-dialog__row">
                <span className="search-dialog__title">{n.title}</span>
                <span className="search-dialog__board">
                  from {n.board.name} · expires {formatShortDate(n.expiresAt)}
                </span>
                <button
                  className="btn"
                  disabled={busyId === n.id}
                  onClick={() => handleRestore(n.id, 'note')}
                >
                  Restore
                </button>
                <button
                  className="btn recycle-bin__delete"
                  disabled={busyId === n.id}
                  onClick={() => handlePermanentDelete(n.id, 'note', n.title)}
                >
                  Delete forever
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
