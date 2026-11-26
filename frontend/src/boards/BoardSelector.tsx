import { useNavigate } from 'react-router-dom';
import type { Board } from '../services/types';

interface BoardSelectorProps {
  boards: Board[];
  currentBoardId: string | undefined;
}

export function BoardSelector({ boards, currentBoardId }: BoardSelectorProps) {
  const navigate = useNavigate();

  return (
    <select
      className="board-selector"
      value={currentBoardId ?? ''}
      onChange={(e) => navigate(`/boards/${e.target.value}`)}
    >
      {boards.map((board) => (
        <option key={board.id} value={board.id}>
          {board.name}
        </option>
      ))}
    </select>
  );
}
