import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBoardsContext } from '../contexts/BoardsContext';
import { BoardSelector } from '../boards/BoardSelector';
import { CreateBoardDialog } from '../boards/CreateBoardDialog';

export function AppShell() {
  const { user, logout } = useAuth();
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, createBoard } = useBoardsContext();
  const navigate = useNavigate();
  const [showCreateBoard, setShowCreateBoard] = useState(false);

  async function handleCreateBoard(name: string) {
    const board = await createBoard(name);
    navigate(`/boards/${board.id}`);
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="top-bar__logo">Household Whiteboard</span>
        {boards.length > 0 && <BoardSelector boards={boards} currentBoardId={boardId} />}
        <button className="btn" onClick={() => setShowCreateBoard(true)}>
          + Board
        </button>
        <div className="top-bar__spacer" />
        {user && (
          <span className="user-badge">
            <span className="user-badge__dot" style={{ background: user.authorColour }} />
            {user.displayName}
          </span>
        )}
        <button className="btn" onClick={() => logout()}>
          Log out
        </button>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
      {showCreateBoard && (
        <CreateBoardDialog onCreate={handleCreateBoard} onClose={() => setShowCreateBoard(false)} />
      )}
    </div>
  );
}
