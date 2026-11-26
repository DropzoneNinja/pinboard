import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/api';
import type { BoardView } from '../services/types';

const DEFAULT_VIEW: BoardView = { viewportX: 0, viewportY: 0, zoomLevel: 1 };
const SAVE_DEBOUNCE_MS = 500;

export function useBoardView(boardId: string | undefined) {
  const [view, setView] = useState<BoardView>(DEFAULT_VIEW);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!boardId) return;
    setLoaded(false);
    apiFetch<{ view: BoardView }>(`/boards/${boardId}/view`)
      .then(({ view }) => setView(view))
      .finally(() => setLoaded(true));
  }, [boardId]);

  const updateView = useCallback(
    (next: BoardView) => {
      setView(next);
      if (!boardId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        apiFetch(`/boards/${boardId}/view`, { method: 'PUT', body: next }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [boardId],
  );

  return { view, loaded, updateView };
}
