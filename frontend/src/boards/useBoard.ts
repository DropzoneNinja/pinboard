import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { Board } from '../services/types';

export function useBoard(boardId: string | undefined) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    setBoard(null);
    apiFetch<{ board: Board }>(`/boards/${boardId}`)
      .then(({ board }) => setBoard(board))
      .finally(() => setLoading(false));
  }, [boardId]);

  return { board, loading };
}
