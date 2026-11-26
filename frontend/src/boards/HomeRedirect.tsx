import { Navigate } from 'react-router-dom';
import { useBoardsContext } from '../contexts/BoardsContext';

export function HomeRedirect() {
  const { boards, loading } = useBoardsContext();

  if (loading) {
    return <div className="full-page-status">Loading…</div>;
  }
  if (boards.length === 0) {
    return <div className="full-page-status">No boards yet. Create one to get started.</div>;
  }
  return <Navigate to={`/boards/${boards[0]!.id}`} replace />;
}
