import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBoard } from './useBoard';
import { useBoardNotes } from './useBoardNotes';
import { useBoardView } from './useBoardView';
import { Toolbar } from './Toolbar';
import { CreateBoardDialog } from './CreateBoardDialog';
import { useBoardsContext } from '../contexts/BoardsContext';
import { NoteCard } from '../notes/NoteCard';
import { boardBackgroundStyle } from './background';
import { fitAllView, screenToWorld, zoomAtCenter, zoomAtPoint } from './canvasMath';
import type { BoardView, Note } from '../services/types';

// TipTap and its extensions are hefty; only load them once a note is actually opened.
const NoteEditor = lazy(() => import('../notes/NoteEditor').then((m) => ({ default: m.NoteEditor })));

const DEFAULT_NOTE_SIZE = { width: 220, height: 220 };

interface DragInfo {
  noteId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface ResizeInfo {
  noteId: string;
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
}

interface PanInfo {
  startClientX: number;
  startClientY: number;
  startViewportX: number;
  startViewportY: number;
}

export function Whiteboard() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { board } = useBoard(boardId);
  const { notes, createNote, patchNote } = useBoardNotes(boardId);
  const { view, loaded: viewLoaded, updateView } = useBoardView(boardId);
  const { createBoard } = useBoardsContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<BoardView>(view);
  const notesRef = useRef<Note[]>(notes);
  const dragRef = useRef<DragInfo | null>(null);
  const resizeRef = useRef<ResizeInfo | null>(null);
  const panRef = useRef<PanInfo | null>(null);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragOverride, setDragOverride] = useState<{ noteId: string; x: number; y: number } | null>(null);
  const [resizeOverride, setResizeOverride] = useState<{ noteId: string; w: number; h: number } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [searchStubVisible, setSearchStubVisible] = useState(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const createNoteAt = useCallback(
    (worldX: number, worldY: number) => {
      createNote({
        positionX: worldX - DEFAULT_NOTE_SIZE.width / 2,
        positionY: worldY - DEFAULT_NOTE_SIZE.height / 2,
      })
        .then((note) => {
          if (note) {
            setSelectedNoteId(note.id);
            setOpenNoteId(note.id);
          }
        })
        .catch(() => {});
    },
    [createNote],
  );

  const handleNewNoteAtCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, viewRef.current);
    const jitter = () => (Math.random() - 0.5) * 60;
    createNoteAt(center.x + jitter(), center.y + jitter());
  }, [createNoteAt]);

  // Global drag/resize/pan listeners, attached once; refs keep them reading live state.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = (e.clientX - d.startClientX) / viewRef.current.zoomLevel;
        const dy = (e.clientY - d.startClientY) / viewRef.current.zoomLevel;
        if (Math.abs(e.clientX - d.startClientX) > 3 || Math.abs(e.clientY - d.startClientY) > 3) {
          d.moved = true;
        }
        setDragOverride({ noteId: d.noteId, x: d.startX + dx, y: d.startY + dy });
      } else if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = (e.clientX - r.startClientX) / viewRef.current.zoomLevel;
        const dy = (e.clientY - r.startClientY) / viewRef.current.zoomLevel;
        setResizeOverride({
          noteId: r.noteId,
          w: Math.max(120, r.startWidth + dx),
          h: Math.max(100, r.startHeight + dy),
        });
      } else if (panRef.current) {
        const p = panRef.current;
        updateView({
          ...viewRef.current,
          viewportX: p.startViewportX + (e.clientX - p.startClientX),
          viewportY: p.startViewportY + (e.clientY - p.startClientY),
        });
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (dragRef.current) {
        const d = dragRef.current;
        dragRef.current = null;
        setDragOverride(null);
        if (d.moved) {
          const finalX = d.startX + (e.clientX - d.startClientX) / viewRef.current.zoomLevel;
          const finalY = d.startY + (e.clientY - d.startClientY) / viewRef.current.zoomLevel;
          const note = notesRef.current.find((n) => n.id === d.noteId);
          if (note) {
            patchNote(note.id, note.version, { positionX: finalX, positionY: finalY }).catch(() => {});
          }
        } else {
          setSelectedNoteId(d.noteId);
          setOpenNoteId(d.noteId);
        }
      } else if (resizeRef.current) {
        const r = resizeRef.current;
        resizeRef.current = null;
        setResizeOverride(null);
        const finalW = Math.max(120, r.startWidth + (e.clientX - r.startClientX) / viewRef.current.zoomLevel);
        const finalH = Math.max(100, r.startHeight + (e.clientY - r.startClientY) / viewRef.current.zoomLevel);
        const note = notesRef.current.find((n) => n.id === r.noteId);
        if (note) {
          patchNote(note.id, note.version, { width: finalW, height: finalH }).catch(() => {});
        }
      } else if (panRef.current) {
        panRef.current = null;
        setIsPanning(false);
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateView, patchNote]);

  // Wheel zoom, centred on the cursor. Attached natively so preventDefault reliably stops page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.001);
      updateView(zoomAtPoint(viewRef.current, rect, e.clientX, e.clientY, factor));
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [updateView]);

  // Keyboard shortcuts: Space to pan, Escape to deselect, Ctrl/Cmd+N for a new note.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        setSpacePressed(true);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setSelectedNoteId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewNoteAtCenter();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpacePressed(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleNewNoteAtCenter]);

  function handleContainerMouseDown(e: ReactMouseEvent) {
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      e.preventDefault();
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startViewportX: viewRef.current.viewportX,
        startViewportY: viewRef.current.viewportY,
      };
      setIsPanning(true);
      return;
    }
    if (e.button === 0) {
      setSelectedNoteId(null);
    }
  }

  function handleContainerDoubleClick(e: ReactMouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(e.clientX, e.clientY, rect, viewRef.current);
    createNoteAt(world.x, world.y);
  }

  function handleZoom(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    updateView(zoomAtCenter(viewRef.current, rect, factor));
  }

  function handleResetView() {
    updateView({ viewportX: 0, viewportY: 0, zoomLevel: 1 });
  }

  function handleFitAll() {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    updateView(
      fitAllView(
        notes.map((n) => ({
          minX: n.positionX,
          minY: n.positionY,
          maxX: n.positionX + n.width,
          maxY: n.positionY + n.height,
        })),
        rect,
      ),
    );
  }

  function handleBringToFront(note: Note) {
    const maxZ = notes.reduce((max, n) => Math.max(max, n.zIndex), 0);
    if (note.zIndex > maxZ) return;
    patchNote(note.id, note.version, { zIndex: maxZ + 1 }).catch(() => {});
  }

  function handleSendToBack(note: Note) {
    const minZ = notes.reduce((min, n) => Math.min(min, n.zIndex), 0);
    if (note.zIndex < minZ) return;
    patchNote(note.id, note.version, { zIndex: minZ - 1 }).catch(() => {});
  }

  async function handleCreateBoard(name: string) {
    const newBoard = await createBoard(name);
    navigate(`/boards/${newBoard.id}`);
  }

  function handleSearchStub() {
    setSearchStubVisible(true);
    setTimeout(() => setSearchStubVisible(false), 2500);
  }

  return (
    <div className="whiteboard-page">
      <Toolbar
        onNewNote={handleNewNoteAtCenter}
        onNewBoard={() => setShowCreateBoard(true)}
        onSearch={handleSearchStub}
        onZoomIn={() => handleZoom(1.2)}
        onZoomOut={() => handleZoom(1 / 1.2)}
        onResetView={handleResetView}
        onFitAll={handleFitAll}
      />
      {searchStubVisible && <div className="toast">Search is coming in a later update.</div>}
      <div
        ref={containerRef}
        className="whiteboard-viewport"
        style={{
          ...boardBackgroundStyle(board),
          cursor: isPanning ? 'grabbing' : spacePressed ? 'grab' : 'default',
        }}
        onMouseDown={handleContainerMouseDown}
        onDoubleClick={handleContainerDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {viewLoaded && (
          <div
            className="whiteboard-world"
            style={{
              transform: `translate(${view.viewportX}px, ${view.viewportY}px) scale(${view.zoomLevel})`,
            }}
          >
            {notes.map((note) => {
              const pos =
                dragOverride && dragOverride.noteId === note.id
                  ? { x: dragOverride.x, y: dragOverride.y }
                  : { x: note.positionX, y: note.positionY };
              const size =
                resizeOverride && resizeOverride.noteId === note.id
                  ? { width: resizeOverride.w, height: resizeOverride.h }
                  : { width: note.width, height: note.height };
              const isActive =
                dragRef.current?.noteId === note.id || resizeRef.current?.noteId === note.id;
              return (
                <NoteCard
                  key={note.id}
                  note={note}
                  x={pos.x}
                  y={pos.y}
                  width={size.width}
                  height={size.height}
                  isSelected={selectedNoteId === note.id}
                  isActive={isActive}
                  onSelect={() => {
                    setSelectedNoteId(note.id);
                    setOpenNoteId(note.id);
                  }}
                  onHeaderMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    dragRef.current = {
                      noteId: note.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startX: note.positionX,
                      startY: note.positionY,
                      moved: false,
                    };
                  }}
                  onResizeMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button !== 0) return;
                    resizeRef.current = {
                      noteId: note.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startWidth: note.width,
                      startHeight: note.height,
                    };
                  }}
                  onBringToFront={() => handleBringToFront(note)}
                  onSendToBack={() => handleSendToBack(note)}
                />
              );
            })}
          </div>
        )}
      </div>
      {showCreateBoard && (
        <CreateBoardDialog onCreate={handleCreateBoard} onClose={() => setShowCreateBoard(false)} />
      )}
      {openNoteId && (
        <Suspense fallback={<div className="note-editor-overlay" />}>
          <NoteEditor
            key={openNoteId}
            noteId={openNoteId}
            patchNote={patchNote}
            onClose={() => setOpenNoteId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
