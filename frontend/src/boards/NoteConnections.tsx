import { useMemo } from 'react';
import type { Note, NoteConnection } from '../services/types';

interface DraftConnection {
  fromNoteId: string;
  toX: number;
  toY: number;
}

interface NoteConnectionsProps {
  notes: Note[];
  connections: NoteConnection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  draft: DraftConnection | null;
}

function centerOf(note: Note): { x: number; y: number } {
  return { x: note.positionX + note.width / 2, y: note.positionY + note.height / 2 };
}

/**
 * The "string" lines pinned between notes. Rendered behind the note cards (mounted before them
 * in the whiteboard-world stacking order) so each string visually originates from under the
 * note it's pinned to, rather than floating on top of its content.
 */
export function NoteConnections({
  notes,
  connections,
  selectedConnectionId,
  onSelectConnection,
  draft,
}: NoteConnectionsProps) {
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const draftFromNote = draft ? notesById.get(draft.fromNoteId) : undefined;
  // "Send to back" can push a note's own z-index below 0 (CSS's default stacking position for
  // an unset z-index), so pin this below the lowest note on the board rather than relying on
  // DOM order — otherwise a string could end up painted on top of a fully-sent-to-back note.
  const zIndex = Math.min(0, ...notes.map((n) => n.zIndex)) - 1;

  return (
    // A zero width/height root <svg> is spec'd to disable rendering of the whole element, even
    // with overflow:visible — so this needs a nominal non-zero viewport; the actual lines are
    // drawn in raw world-pixel coordinates (no viewBox) and painted outside it regardless.
    <svg className="note-connections" style={{ zIndex }} width={1} height={1}>
      {connections.map((connection) => {
        const noteA = notesById.get(connection.noteAId);
        const noteB = notesById.get(connection.noteBId);
        if (!noteA || !noteB) return null;
        const a = centerOf(noteA);
        const b = centerOf(noteB);
        const isSelected = connection.id === selectedConnectionId;
        return (
          <g key={connection.id}>
            <line
              className="note-connection__hit-area"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectConnection(connection.id);
              }}
            />
            <line
              className={`note-connection__string${isSelected ? ' note-connection__string--selected' : ''}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          </g>
        );
      })}
      {draft && draftFromNote && (
        <line
          className="note-connection__draft"
          x1={centerOf(draftFromNote).x}
          y1={centerOf(draftFromNote).y}
          x2={draft.toX}
          y2={draft.toY}
        />
      )}
    </svg>
  );
}
