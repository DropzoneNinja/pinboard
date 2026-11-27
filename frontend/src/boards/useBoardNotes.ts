import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { Note } from '../services/types';

type CreateNoteInput = { positionX: number; positionY: number };
type PatchNoteInput = Partial<
  Pick<
    Note,
    | 'title'
    | 'content'
    | 'positionX'
    | 'positionY'
    | 'width'
    | 'height'
    | 'zIndex'
    | 'backgroundColour'
  >
>;

export function useBoardNotes(boardId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe, joinBoard, leaveBoard, onReconnect } = useSocket();

  const fetchNotes = useCallback(() => {
    if (!boardId) return Promise.resolve();
    return apiFetch<{ notes: Note[] }>(`/boards/${boardId}/notes`).then(({ notes }) =>
      setNotes(notes),
    );
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    fetchNotes().finally(() => setLoading(false));
  }, [boardId, fetchNotes]);

  // Join this board's socket room so we receive its live note events; leave on unmount/switch.
  useEffect(() => {
    if (!boardId) return;
    joinBoard(boardId);
    return () => leaveBoard(boardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // After a dropped connection reconnects, the server has lost our room membership and we may
  // have missed events while offline — resync by refetching rather than trying to replay a gap.
  useEffect(() => onReconnect(() => void fetchNotes()), [onReconnect, fetchNotes]);

  useEffect(() => {
    return subscribe((message) => {
      switch (message.type) {
        case 'note:created':
        case 'note:restored':
          if (message.note.boardId !== boardId) return;
          setNotes((prev) =>
            prev.some((n) => n.id === message.note.id)
              ? prev.map((n) => (n.id === message.note.id ? message.note : n))
              : [...prev, message.note],
          );
          break;
        case 'note:layout':
        case 'note:content':
          if (message.note.boardId !== boardId) return;
          setNotes((prev) => prev.map((n) => (n.id === message.note.id ? message.note : n)));
          break;
        case 'note:archived':
        case 'note:deleted':
          if (message.boardId !== boardId) return;
          setNotes((prev) => prev.filter((n) => n.id !== message.noteId));
          break;
        case 'board:content_restored':
          // A whiteboard import replaced this board's notes wholesale — easier (and more
          // correct) to just refetch than to reconcile a diff against the entire note list.
          if (message.boardId !== boardId) return;
          void fetchNotes();
          break;
        default:
          break;
      }
    });
  }, [subscribe, boardId, fetchNotes]);

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

  const removeNoteLocally = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  return { notes, loading, createNote, patchNote, removeNoteLocally, refetch: fetchNotes };
}
