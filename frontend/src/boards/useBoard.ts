import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { Board } from '../services/types';

export function useBoard(boardId: string | undefined) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const { subscribe, onReconnect } = useSocket();

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    setBoard(null);
    apiFetch<{ board: Board }>(`/boards/${boardId}`)
      .then(({ board }) => setBoard(board))
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    return onReconnect(() => {
      apiFetch<{ board: Board }>(`/boards/${boardId}`)
        .then(({ board }) => setBoard(board))
        .catch(() => {});
    });
  }, [boardId, onReconnect]);

  useEffect(() => {
    return subscribe((message) => {
      if (
        message.type === 'board:updated' ||
        message.type === 'board:archived' ||
        message.type === 'board:restored'
      ) {
        if (message.board.id === boardId) setBoard(message.board);
      }
    });
  }, [subscribe, boardId]);

  return { board, loading, setBoard };
}
