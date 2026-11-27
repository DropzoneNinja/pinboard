import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Modal } from '../components/Modal';
import { apiFetch, ApiError, uploadFile } from '../services/api';
import type { Board } from '../services/types';

interface BoardSettingsDialogProps {
  board: Board;
  onClose: () => void;
  onUpdated: (board: Board) => void;
  onDeleted: () => void;
}

const BACKGROUND_STYLES: { value: Board['backgroundStyle']; label: string }[] = [
  { value: 'plain', label: 'Plain white' },
  { value: 'grey', label: 'Light grey' },
  { value: 'grid', label: 'Subtle grid' },
  { value: 'dotted', label: 'Dotted paper' },
];

export function BoardSettingsDialog({
  board,
  onClose,
  onUpdated,
  onDeleted,
}: BoardSettingsDialogProps) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? '');
  const [backgroundStyle, setBackgroundStyle] = useState(board.backgroundStyle);
  const [version, setVersion] = useState(board.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { board: updated } = await apiFetch<{ board: Board }>(`/boards/${board.id}`, {
        method: 'PATCH',
        body: {
          version,
          name: name.trim(),
          description: description.trim() || null,
          backgroundStyle,
        },
      });
      setVersion(updated.version);
      onUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          'This board was changed elsewhere. Reopen board settings to see the latest version.',
        );
      } else {
        setError('Could not save board settings.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    setSaving(true);
    try {
      const { board: updated } = await apiFetch<{ board: Board }>(
        `/boards/${board.id}/${board.isArchived ? 'restore' : 'archive'}`,
        { method: 'POST' },
      );
      onUpdated(updated);
      if (!board.isArchived) onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const a = document.createElement('a');
    a.href = `/api/v1/boards/${board.id}/export`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (
      !window.confirm(
        `Restore "${board.name}" from this file? This replaces all of its current notes and connections with what's in the file. This cannot be undone.`,
      )
    ) {
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const { board: updated } = await uploadFile<{ board: Board }>(
        `/boards/${board.id}/import`,
        file,
      );
      onUpdated(updated);
      onClose();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Could not restore from that file.');
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${board.name}"? It will move to the recycle bin and can be restored there.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/boards/${board.id}`, { method: 'DELETE' });
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Board settings" onClose={onClose}>
      <form onSubmit={handleSave}>
        <label className="field">Name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
        />

        <label className="field">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="Optional"
        />

        <label className="field">Background</label>
        <select
          className="input"
          value={backgroundStyle}
          onChange={(e) => setBackgroundStyle(e.target.value as Board['backgroundStyle'])}
        >
          {BACKGROUND_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {error && <p className="form-error">{error}</p>}

        <hr className="settings-divider" />

        <label className="field">Save / restore this whiteboard</label>
        <p className="board-settings__hint">
          Save this board (its notes, connections and images) as a single file, or restore one saved
          earlier — this replaces the board's current contents.
        </p>
        <div className="board-settings__backup-actions">
          <button type="button" className="btn" onClick={handleExport}>
            Save whiteboard to file
          </button>
          <button
            type="button"
            className="btn"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
          >
            {importing ? 'Restoring…' : 'Restore from file…'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        {importError && <p className="form-error">{importError}</p>}

        <div className="modal-card__actions board-settings__actions">
          <button
            type="button"
            className="btn recycle-bin__delete"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete board
          </button>
          <button type="button" className="btn" onClick={handleArchiveToggle} disabled={saving}>
            {board.isArchived ? 'Unarchive' : 'Archive board'}
          </button>
          <span className="top-bar__spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
