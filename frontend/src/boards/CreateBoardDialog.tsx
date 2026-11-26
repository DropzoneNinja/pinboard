import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '../components/Modal';

interface CreateBoardDialogProps {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export function CreateBoardDialog({ onCreate, onClose }: CreateBoardDialogProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch {
      setError('Could not create the board. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New board" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <input
          className="input"
          type="text"
          placeholder="Board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={150}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-card__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
