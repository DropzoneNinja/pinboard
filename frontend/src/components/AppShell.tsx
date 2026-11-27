import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useBoardsContext } from '../contexts/BoardsContext';
import { BoardSelector } from '../boards/BoardSelector';
import { CreateBoardDialog } from '../boards/CreateBoardDialog';
import { RecycleBinDialog } from '../boards/RecycleBinDialog';
import { UserMenu } from './UserMenu';
import logo from '../assets/pinboard-logo.png';

export function AppShell() {
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, createBoard } = useBoardsContext();
  const navigate = useNavigate();
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  async function handleCreateBoard(name: string) {
    const board = await createBoard(name);
    navigate(`/boards/${board.id}`);
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="top-bar__logo">
          <img src={logo} alt="" className="top-bar__logo-icon" />
          Household Whiteboard
        </span>
        {boards.length > 0 && <BoardSelector boards={boards} currentBoardId={boardId} />}
        <button className="btn" onClick={() => setShowCreateBoard(true)}>
          + Board
        </button>
        <div className="top-bar__spacer" />
        <button className="btn" onClick={() => setShowRecycleBin(true)}>
          Recycle bin
        </button>
        <UserMenu />
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
      {showCreateBoard && (
        <CreateBoardDialog onCreate={handleCreateBoard} onClose={() => setShowCreateBoard(false)} />
      )}
      {showRecycleBin && <RecycleBinDialog onClose={() => setShowRecycleBin(false)} />}
    </div>
  );
}
