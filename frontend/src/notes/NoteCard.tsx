import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Note } from '../services/types';
import { resolveNoteColour } from './palette';
import { contentTypeIcon } from './contentTypeIcon';
import { formatShortDate } from '../services/formatDate';
import { contrastingTextColour } from '../services/colour';
import { NotePreview } from './NotePreview';

interface NoteCardProps {
  note: Note;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onHeaderMouseDown: (e: MouseEvent) => void;
  onResizeMouseDown: (e: MouseEvent) => void;
  onLinkHandleMouseDown: (e: MouseEvent) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export function NoteCard({
  note,
  x,
  y,
  width,
  height,
  isSelected,
  isActive,
  onSelect,
  onHeaderMouseDown,
  onResizeMouseDown,
  onLinkHandleMouseDown,
  onBringToFront,
  onSendToBack,
}: NoteCardProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setBodySize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    background: resolveNoteColour(note.backgroundColour),
    zIndex: isActive ? 100000 : note.zIndex,
    boxShadow: isActive
      ? '0 12px 24px rgba(0,0,0,0.18)'
      : isSelected
        ? '0 4px 10px rgba(0,0,0,0.14)'
        : '0 2px 6px rgba(0,0,0,0.1)',
    outline: isSelected ? '2px solid #3B82F6' : 'none',
    outlineOffset: 2,
  };

  return (
    <div
      className="note-card"
      style={style}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="note-card__header" onMouseDown={onHeaderMouseDown}>
        <span
          className="note-card__content-icon note-card__link-handle"
          title="Drag to another note to connect them with a string"
          onMouseDown={onLinkHandleMouseDown}
          onClick={(e) => e.stopPropagation()}
        >
          {contentTypeIcon(note.contentType)}
        </span>
        <span className="note-card__title">{note.title}</span>
        {isSelected && (
          <span className="note-card__layer-actions">
            <button
              type="button"
              title="Send to back"
              onClick={(e) => {
                e.stopPropagation();
                onSendToBack();
              }}
            >
              ↓
            </button>
            <button
              type="button"
              title="Bring to front"
              onClick={(e) => {
                e.stopPropagation();
                onBringToFront();
              }}
            >
              ↑
            </button>
          </span>
        )}
        <span
          className="note-card__creator-badge"
          title={`Created by ${note.creator.displayName}`}
          style={{
            background: note.creator.authorColour,
            color: contrastingTextColour(note.creator.authorColour),
          }}
        >
          {note.creator.displayName.charAt(0).toUpperCase() || '?'}
        </span>
      </div>
      <div className="note-card__body" ref={bodyRef}>
        <NotePreview content={note.content} width={bodySize.width} height={bodySize.height} />
      </div>
      <div className="note-card__footer" title={`Last updated by ${note.updater.displayName}`}>
        <span className="note-card__author-dot" style={{ background: note.updater.authorColour }} />
        <span className="note-card__updated-date">{formatShortDate(note.updatedAt)}</span>
      </div>
      <div className="note-card__resize-handle" onMouseDown={onResizeMouseDown} />
    </div>
  );
}
