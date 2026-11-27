import { PresenceIndicator } from './PresenceIndicator';
import type { PresenceUser } from '../services/types';

interface ToolbarProps {
  onNewNote: () => void;
  onNewBoard: () => void;
  onSearch: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitAll: () => void;
  onArchive: () => void;
  onBoardSettings: () => void;
  presence: PresenceUser[];
}

export function Toolbar({
  onNewNote,
  onNewBoard,
  onSearch,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitAll,
  onArchive,
  onBoardSettings,
  presence,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button className="toolbar__btn" title="New note (Ctrl/Cmd+N)" onClick={onNewNote}>
        + Note
      </button>
      <button className="toolbar__btn" title="New board" onClick={onNewBoard}>
        + Board
      </button>
      <button className="toolbar__btn" title="Search (Ctrl/Cmd+F)" onClick={onSearch}>
        Search
      </button>
      <button className="toolbar__btn" title="Archived notes" onClick={onArchive}>
        Archive
      </button>
      <span className="toolbar__divider" />
      <button className="toolbar__btn toolbar__btn--icon" title="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button className="toolbar__btn toolbar__btn--icon" title="Zoom in" onClick={onZoomIn}>
        +
      </button>
      <button className="toolbar__btn" title="Reset view" onClick={onResetView}>
        Reset view
      </button>
      <button className="toolbar__btn" title="Fit all notes" onClick={onFitAll}>
        Fit all
      </button>
      <span className="toolbar__divider" />
      <button
        className="toolbar__btn toolbar__btn--icon"
        title="Board settings"
        onClick={onBoardSettings}
      >
        ⚙
      </button>
      <PresenceIndicator users={presence} />
    </div>
  );
}
