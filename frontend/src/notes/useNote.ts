import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { Note } from '../services/types';

export function useNote(noteId: string | undefined) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!noteId) return;
    setLoading(true);
    setNote(null);
    apiFetch<{ note: Note }>(`/notes/${noteId}`)
      .then(({ note }) => setNote(note))
      .finally(() => setLoading(false));
  }, [noteId]);

  return { note, loading };
}
