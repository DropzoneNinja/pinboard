import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { Board } from '../services/types';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { boards } = await apiFetch<{ boards: Board[] }>('/boards');
    setBoards(boards);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

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
