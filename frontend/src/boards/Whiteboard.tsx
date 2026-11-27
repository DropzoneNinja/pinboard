import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useBoard } from './useBoard';
import { useBoardNotes } from './useBoardNotes';
import { useBoardConnections } from './useBoardConnections';
import { useBoardView } from './useBoardView';
import { useBoardPresence } from './useBoardPresence';
import { Toolbar } from './Toolbar';
import { CreateBoardDialog } from './CreateBoardDialog';
import { SearchDialog } from './SearchDialog';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { useBoardsContext } from '../contexts/BoardsContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { NoteCard } from '../notes/NoteCard';
import { NoteConnections } from './NoteConnections';
import { ArchiveDialog } from '../notes/ArchiveDialog';
import { boardBackgroundStyle } from './background';
import {
  centerOnNote,
  fitAllView,
  noteAtPoint,
  screenToWorld,
  zoomAtCenter,
  zoomAtPoint,
} from './canvasMath';
import { createUndoStack } from './undo';
import type { UndoEntry } from './undo';
import { apiFetch } from '../services/api';
import type { BoardView, Note, SearchBoardResult, SearchNoteResult } from '../services/types';

// TipTap and its extensions are hefty; only load them once a note is actually opened.
const NoteEditor = lazy(() =>
  import('../notes/NoteEditor').then((m) => ({ default: m.NoteEditor })),
);

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
  moved: boolean;
}

interface LinkInfo {
  fromNoteId: string;
  startClientX: number;
  startClientY: number;
  moved: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function Whiteboard() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { board, setBoard } = useBoard(boardId);
  const { notes, createNote, patchNote, removeNoteLocally } = useBoardNotes(boardId);
  const { connections, createConnection, removeConnection } = useBoardConnections(boardId);
  const { view, loaded: viewLoaded, updateView } = useBoardView(boardId);
  const { createBoard } = useBoardsContext();
  const { settings } = useAppSettings();
  const presence = useBoardPresence(boardId);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<BoardView>(view);
  const notesRef = useRef<Note[]>(notes);
  const dragRef = useRef<DragInfo | null>(null);
  const resizeRef = useRef<ResizeInfo | null>(null);
  // The note element follows the cursor while dragging/resizing, so mousedown and mouseup both
  // land on it — the browser fires a native `click` right after mouseup regardless, which would
  // otherwise re-open the note we just finished dragging. This flags that click to be swallowed.
  const suppressClickRef = useRef(false);
  function suppressNextClick() {
    suppressClickRef.current = true;
    // Safety net: the browser's click fires synchronously right after mouseup, well before
    // this runs, but if it somehow never fires, don't leave every future click dead.
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }
  const panRef = useRef<PanInfo | null>(null);
  const linkRef = useRef<LinkInfo | null>(null);
  const undoStackRef = useRef(createUndoStack());
  const handledCenterRef = useRef<string | null>(null);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState<{
    fromNoteId: string;
    toX: number;
    toY: number;
  } | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragOverride, setDragOverride] = useState<{ noteId: string; x: number; y: number } | null>(
    null,
  );
  const [resizeOverride, setResizeOverride] = useState<{
    noteId: string;
    w: number;
    h: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);

  const anyDialogOpen =
    showCreateBoard || showSearch || showArchive || showBoardSettings || !!openNoteId;

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const createNoteAt = useCallback(
    (worldX: number, worldY: number) => {
      createNote({
        positionX: worldX - settings.defaultNoteWidth / 2,
        positionY: worldY - settings.defaultNoteHeight / 2,
      })
        .then((note) => {
          if (note) {
            setSelectedNoteId(note.id);
            setOpenNoteId(note.id);
          }
        })
        .catch(() => {});
    },
    [createNote, settings.defaultNoteWidth, settings.defaultNoteHeight],
  );

  const handleNewNoteAtCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect,
      viewRef.current,
    );
    const jitter = () => (Math.random() - 0.5) * 60;
    createNoteAt(center.x + jitter(), center.y + jitter());
  }, [createNoteAt]);

  const registerUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry);
  }, []);

  const handleUndo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    if (entry.type === 'delete') {
      apiFetch(`/recycle-bin/${entry.noteId}/restore?type=note`, { method: 'POST' }).catch(
        () => {},
      );
      return;
    }
    if (entry.type === 'connect') {
      removeConnection(entry.connectionId).catch(() => {});
      return;
    }
    const note = notesRef.current.find((n) => n.id === entry.noteId);
    if (!note) return;
    if (entry.type === 'move') {
      patchNote(note.id, note.version, { positionX: entry.prevX, positionY: entry.prevY }).catch(
        () => {},
      );
    } else if (entry.type === 'resize') {
      patchNote(note.id, note.version, { width: entry.prevWidth, height: entry.prevHeight }).catch(
        () => {},
      );
    } else if (entry.type === 'colour') {
      patchNote(note.id, note.version, { backgroundColour: entry.prevColour }).catch(() => {});
    }
  }, [patchNote, removeConnection]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNoteId) return;
    const note = notesRef.current.find((n) => n.id === selectedNoteId);
    if (!note) return;
    apiFetch(`/notes/${note.id}`, { method: 'DELETE' })
      .then(() => {
        registerUndo({ type: 'delete', noteId: note.id });
        removeNoteLocally(note.id);
        setSelectedNoteId(null);
      })
      .catch(() => {});
  }, [selectedNoteId, removeNoteLocally, registerUndo]);

  const handleDeleteSelectedConnection = useCallback(() => {
    if (!selectedConnectionId) return;
    removeConnection(selectedConnectionId)
      .then(() => setSelectedConnectionId(null))
      .catch(() => {});
  }, [selectedConnectionId, removeConnection]);

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
        if (
          !p.moved &&
          (Math.abs(e.clientX - p.startClientX) > 3 || Math.abs(e.clientY - p.startClientY) > 3)
        ) {
          p.moved = true;
          setIsPanning(true);
        }
        if (p.moved) {
          updateView({
            ...viewRef.current,
            viewportX: p.startViewportX + (e.clientX - p.startClientX),
            viewportY: p.startViewportY + (e.clientY - p.startClientY),
          });
        }
      } else if (linkRef.current) {
        const l = linkRef.current;
        if (Math.abs(e.clientX - l.startClientX) > 3 || Math.abs(e.clientY - l.startClientY) > 3) {
          l.moved = true;
        }
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const world = screenToWorld(e.clientX, e.clientY, rect, viewRef.current);
          setLinkDraft({ fromNoteId: l.fromNoteId, toX: world.x, toY: world.y });
        }
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (dragRef.current) {
        const d = dragRef.current;
        dragRef.current = null;
        setDragOverride(null);
        if (d.moved) {
          suppressNextClick();
          const finalX = d.startX + (e.clientX - d.startClientX) / viewRef.current.zoomLevel;
          const finalY = d.startY + (e.clientY - d.startClientY) / viewRef.current.zoomLevel;
          const note = notesRef.current.find((n) => n.id === d.noteId);
          if (note) {
            registerUndo({
              type: 'move',
              noteId: note.id,
              prevX: note.positionX,
              prevY: note.positionY,
            });
            patchNote(note.id, note.version, { positionX: finalX, positionY: finalY }).catch(
              () => {},
            );
          }
        } else {
          setSelectedNoteId(d.noteId);
          setOpenNoteId(d.noteId);
        }
      } else if (resizeRef.current) {
        suppressNextClick();
        const r = resizeRef.current;
        resizeRef.current = null;
        setResizeOverride(null);
        const finalW = Math.max(
          120,
          r.startWidth + (e.clientX - r.startClientX) / viewRef.current.zoomLevel,
        );
        const finalH = Math.max(
          100,
          r.startHeight + (e.clientY - r.startClientY) / viewRef.current.zoomLevel,
        );
        const note = notesRef.current.find((n) => n.id === r.noteId);
        if (note) {
          registerUndo({
            type: 'resize',
            noteId: note.id,
            prevWidth: note.width,
            prevHeight: note.height,
          });
          patchNote(note.id, note.version, { width: finalW, height: finalH }).catch(() => {});
        }
      } else if (panRef.current) {
        const p = panRef.current;
        panRef.current = null;
        setIsPanning(false);
        if (!p.moved) {
          setSelectedNoteId(null);
          setSelectedConnectionId(null);
        }
      } else if (linkRef.current) {
        const l = linkRef.current;
        linkRef.current = null;
        setLinkDraft(null);
        if (l.moved) suppressNextClick();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const world = screenToWorld(e.clientX, e.clientY, rect, viewRef.current);
          const target = noteAtPoint(notesRef.current, world.x, world.y);
          if (target && target.id !== l.fromNoteId) {
            createConnection(l.fromNoteId, target.id)
              .then((connection) => {
                if (connection) registerUndo({ type: 'connect', connectionId: connection.id });
              })
              .catch(() => {});
          }
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateView, patchNote, registerUndo, createConnection]);

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

  // Keyboard shortcuts: Space to pan, Escape to deselect, Ctrl/Cmd+N for a new note,
  // Ctrl/Cmd+F to search, Ctrl/Cmd+Z to undo, Delete to delete the selected note.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        setSpacePressed(true);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setSelectedNoteId(null);
        setSelectedConnectionId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!anyDialogOpen) handleNewNoteAtCenter();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!anyDialogOpen) setShowSearch(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!anyDialogOpen) handleUndo();
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        (selectedNoteId || selectedConnectionId)
      ) {
        if (!anyDialogOpen) {
          e.preventDefault();
          if (selectedConnectionId) handleDeleteSelectedConnection();
          else handleDeleteSelected();
        }
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
  }, [
    handleNewNoteAtCenter,
    handleUndo,
    handleDeleteSelected,
    handleDeleteSelectedConnection,
    selectedNoteId,
    selectedConnectionId,
    anyDialogOpen,
  ]);

  // A search result from a different board arrives via navigation state; once this board's
  // notes have loaded, pan/zoom to the requested note and select it.
  useEffect(() => {
    const centerNoteId = (location.state as { centerNoteId?: string } | null)?.centerNoteId;
    if (!centerNoteId || !viewLoaded || notes.length === 0) return;
    if (handledCenterRef.current === centerNoteId) return;
    const note = notes.find((n) => n.id === centerNoteId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (note && rect) {
      handledCenterRef.current = centerNoteId;
      setSelectedNoteId(note.id);
      updateView(centerOnNote(note, rect));
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, viewLoaded, notes, navigate, updateView]);

  function handleContainerMouseDown(e: ReactMouseEvent) {
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      e.preventDefault();
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startViewportX: viewRef.current.viewportX,
        startViewportY: viewRef.current.viewportY,
        moved: true, // middle-click/Space+drag unambiguously mean "pan", no click to disambiguate
      };
      setIsPanning(true);
      return;
    }
    if (e.button === 0) {
      // Plain left-click on empty canvas is ambiguous until the mouse actually moves: a click
      // with no movement should deselect (handled on mouseup below), but a click-and-drag should
      // pan the canvas instead — mirrors the drag-vs-click handling used for notes.
      e.preventDefault();
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startViewportX: viewRef.current.viewportX,
        startViewportY: viewRef.current.viewportY,
        moved: false,
      };
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

  function handleSelectSearchNote(result: SearchNoteResult) {
    setShowSearch(false);
    if (result.boardId === boardId) {
      const note = notesRef.current.find((n) => n.id === result.id);
      const rect = containerRef.current?.getBoundingClientRect();
      if (note && rect) {
        setSelectedNoteId(note.id);
        updateView(centerOnNote(note, rect));
      }
    } else {
      navigate(`/boards/${result.boardId}`, { state: { centerNoteId: result.id } });
    }
  }

  function handleSelectSearchBoard(result: SearchBoardResult) {
    setShowSearch(false);
    navigate(`/boards/${result.id}`);
  }

  return (
    <div className="whiteboard-page">
      <Toolbar
        onNewNote={handleNewNoteAtCenter}
        onNewBoard={() => setShowCreateBoard(true)}
        onSearch={() => setShowSearch(true)}
        onZoomIn={() => handleZoom(1.2)}
        onZoomOut={() => handleZoom(1 / 1.2)}
        onResetView={handleResetView}
        onFitAll={handleFitAll}
        onArchive={() => setShowArchive(true)}
        onBoardSettings={() => setShowBoardSettings(true)}
        presence={presence}
      />
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
            {/* Live drag/resize overrides applied here so connection strings — drawn from these
                same positions — follow a note smoothly while it's being dragged, not just once
                the move settles and the server confirms it. */}
            {(() => {
              const effectiveNotes = notes.map((note) => ({
                ...note,
                positionX: dragOverride?.noteId === note.id ? dragOverride.x : note.positionX,
                positionY: dragOverride?.noteId === note.id ? dragOverride.y : note.positionY,
                width: resizeOverride?.noteId === note.id ? resizeOverride.w : note.width,
                height: resizeOverride?.noteId === note.id ? resizeOverride.h : note.height,
              }));
              return (
                <>
                  <NoteConnections
                    notes={effectiveNotes}
                    connections={connections}
                    selectedConnectionId={selectedConnectionId}
                    onSelectConnection={(id) => {
                      setSelectedConnectionId(id);
                      setSelectedNoteId(null);
                    }}
                    draft={linkDraft}
                  />
                  {effectiveNotes.map((note) => {
                    const isActive =
                      dragRef.current?.noteId === note.id || resizeRef.current?.noteId === note.id;
                    return (
                      <NoteCard
                        key={note.id}
                        note={note}
                        x={note.positionX}
                        y={note.positionY}
                        width={note.width}
                        height={note.height}
                        isSelected={selectedNoteId === note.id}
                        isActive={isActive}
                        onSelect={() => {
                          if (suppressClickRef.current) {
                            suppressClickRef.current = false;
                            return;
                          }
                          setSelectedNoteId(note.id);
                          setSelectedConnectionId(null);
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
                        onLinkHandleMouseDown={(e) => {
                          e.stopPropagation();
                          if (e.button !== 0) return;
                          linkRef.current = {
                            fromNoteId: note.id,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            moved: false,
                          };
                          setLinkDraft({
                            fromNoteId: note.id,
                            toX: note.positionX + note.width / 2,
                            toY: note.positionY + note.height / 2,
                          });
                        }}
                        onBringToFront={() => handleBringToFront(note)}
                        onSendToBack={() => handleSendToBack(note)}
                      />
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
      </div>
      {showCreateBoard && (
        <CreateBoardDialog onCreate={handleCreateBoard} onClose={() => setShowCreateBoard(false)} />
      )}
      {showSearch && (
        <SearchDialog
          onClose={() => setShowSearch(false)}
          onSelectNote={handleSelectSearchNote}
          onSelectBoard={handleSelectSearchBoard}
        />
      )}
      {showArchive && boardId && (
        <ArchiveDialog
          boardId={boardId}
          onClose={() => setShowArchive(false)}
          onRestored={() => {}}
        />
      )}
      {showBoardSettings && board && (
        <BoardSettingsDialog
          board={board}
          onClose={() => setShowBoardSettings(false)}
          onUpdated={(updated) => setBoard(updated)}
          onDeleted={() => navigate('/')}
        />
      )}
      {openNoteId && (
        <Suspense fallback={<div className="note-editor-overlay" />}>
          <NoteEditor
            key={openNoteId}
            noteId={openNoteId}
            patchNote={patchNote}
            onClose={() => setOpenNoteId(null)}
            onArchived={() => {
              removeNoteLocally(openNoteId);
              setOpenNoteId(null);
              setSelectedNoteId(null);
            }}
            onDeleted={() => {
              removeNoteLocally(openNoteId);
              setOpenNoteId(null);
              setSelectedNoteId(null);
            }}
            onDuplicated={(note) => {
              setSelectedNoteId(note.id);
              setOpenNoteId(note.id);
            }}
            registerUndo={registerUndo}
          />
        </Suspense>
      )}
    </div>
  );
}
