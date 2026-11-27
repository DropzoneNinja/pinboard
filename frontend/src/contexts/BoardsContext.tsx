import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useBoards } from '../boards/useBoards';
import type { Board } from '../services/types';

interface BoardsContextValue {
  boards: Board[];
  loading: boolean;
  createBoard: (name: string) => Promise<Board>;
  reload: () => Promise<void>;
}

const BoardsContext = createContext<BoardsContextValue | null>(null);

export function BoardsProvider({ children }: { children: ReactNode }) {
  const value = useBoards();
  return <BoardsContext.Provider value={value}>{children}</BoardsContext.Provider>;
}

export function useBoardsContext(): BoardsContextValue {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error('useBoardsContext must be used within a BoardsProvider');
  return ctx;
}
