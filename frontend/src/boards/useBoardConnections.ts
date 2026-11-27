import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { NoteConnection } from '../services/types';

/**
 * The "string" links between notes on a board. Room join/leave for this board is owned by
 * useBoardNotes (always mounted alongside this) — this just fetches and listens.
 */
export function useBoardConnections(boardId: string | undefined) {
  const [connections, setConnections] = useState<NoteConnection[]>([]);
  const { subscribe, onReconnect } = useSocket();

  const fetchConnections = useCallback(() => {
    if (!boardId) return Promise.resolve();
    return apiFetch<{ connections: NoteConnection[] }>(`/boards/${boardId}/note-connections`).then(
      ({ connections }) => setConnections(connections),
    );
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    fetchConnections();
  }, [boardId, fetchConnections]);

  useEffect(() => onReconnect(() => void fetchConnections()), [onReconnect, fetchConnections]);

  useEffect(() => {
    return subscribe((message) => {
      switch (message.type) {
        case 'note-connection:created':
          if (message.connection.boardId !== boardId) return;
          setConnections((prev) =>
            prev.some((c) => c.id === message.connection.id) ? prev : [...prev, message.connection],
          );
          break;
        case 'note-connection:deleted':
          if (message.boardId !== boardId) return;
          setConnections((prev) => prev.filter((c) => c.id !== message.connectionId));
          break;
        case 'board:content_restored':
          if (message.boardId !== boardId) return;
          void fetchConnections();
          break;
        default:
          break;
      }
    });
  }, [subscribe, boardId, fetchConnections]);

  const createConnection = useCallback(
    async (noteAId: string, noteBId: string) => {
      if (!boardId) return undefined;
      const { connection } = await apiFetch<{ connection: NoteConnection }>(
        `/boards/${boardId}/note-connections`,
        { method: 'POST', body: { noteAId, noteBId } },
      );
      setConnections((prev) =>
        prev.some((c) => c.id === connection.id) ? prev : [...prev, connection],
      );
      return connection;
    },
    [boardId],
  );

  const removeConnection = useCallback(async (connectionId: string) => {
    await apiFetch(`/note-connections/${connectionId}`, { method: 'DELETE' });
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, []);

  return { connections, createConnection, removeConnection };
}
