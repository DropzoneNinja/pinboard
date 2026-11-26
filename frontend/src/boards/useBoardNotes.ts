import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import type { Note } from '../services/types';

type CreateNoteInput = { positionX: number; positionY: number };
type PatchNoteInput = Partial<
  Pick<Note, 'title' | 'positionX' | 'positionY' | 'width' | 'height' | 'zIndex' | 'backgroundColour'>
>;

export function useBoardNotes(boardId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    apiFetch<{ notes: Note[] }>(`/boards/${boardId}/notes`)
      .then(({ notes }) => setNotes(notes))
      .finally(() => setLoading(false));
  }, [boardId]);

  const createNote = useCallback(
    async (input: CreateNoteInput) => {
      if (!boardId) return undefined;
      const { note } = await apiFetch<{ note: Note }>(`/boards/${boardId}/notes`, {
        method: 'POST',
        body: input,
      });
      setNotes((prev) => [...prev, note]);
      return note;
    },
    [boardId],
  );

  const patchNote = useCallback(async (noteId: string, version: number, fields: PatchNoteInput) => {
    try {
      const { note } = await apiFetch<{ note: Note }>(`/notes/${noteId}`, {
        method: 'PATCH',
        body: { version, ...fields },
      });
      setNotes((prev) => prev.map((n) => (n.id === noteId ? note : n)));
      return note;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const latest = (err.body as { note?: Note } | undefined)?.note;
        if (latest) {
          setNotes((prev) => prev.map((n) => (n.id === noteId ? latest : n)));
        }
      }
      throw err;
    }
  }, []);

  return { notes, loading, createNote, patchNote };
}
