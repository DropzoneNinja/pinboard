import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { Board } from '../services/types';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe, onReconnect } = useSocket();

  const reload = useCallback(async () => {
    const { boards } = await apiFetch<{ boards: Board[] }>('/boards');
    setBoards(boards);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => onReconnect(() => void reload()), [onReconnect, reload]);

  // The board list is small and global, so every client is told about every board change —
  // simpler than per-room scoping, and keeps the selector/home-redirect live for both users.
  useEffect(() => {
    return subscribe((message) => {
      switch (message.type) {
        case 'board:created':
          setBoards((prev) =>
            prev.some((b) => b.id === message.board.id) ? prev : [...prev, message.board],
          );
          break;
        case 'board:updated':
        case 'board:restored':
          setBoards((prev) => {
            const exists = prev.some((b) => b.id === message.board.id);
            if (message.board.isArchived) return prev.filter((b) => b.id !== message.board.id);
            return exists
              ? prev.map((b) => (b.id === message.board.id ? message.board : b))
              : [...prev, message.board];
          });
          break;
        case 'board:archived':
        case 'board:deleted': {
          const id = 'board' in message ? message.board.id : message.boardId;
          setBoards((prev) => prev.filter((b) => b.id !== id));
          break;
        }
        default:
          break;
      }
    });
  }, [subscribe]);

  const createBoard = useCallback(async (name: string) => {
    const { board } = await apiFetch<{ board: Board }>('/boards', {
      method: 'POST',
      body: { name },
    });
    setBoards((prev) => [...prev, board]);
    return board;
  }, []);

  return { boards, loading, createBoard, reload };
}
