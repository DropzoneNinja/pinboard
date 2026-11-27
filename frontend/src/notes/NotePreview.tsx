import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderNoteContentHtml } from './renderNoteContent';

interface NotePreviewProps {
  content: unknown;
  width: number;
  height: number;
}

// A scaled-down, read-only render of a note's full content, shown inside its
// small board representation. Whatever the note contains — text, an image,
// a table — is rendered at its natural size and then uniformly shrunk (never
// enlarged) so all of it fits inside the given box without altering the note
// card's own size.
export function NotePreview({ content, width, height }: NotePreviewProps) {
  const html = useMemo(() => renderNoteContentHtml(content), [content]);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || width <= 0 || height <= 0) return;

    function measure() {
      const naturalWidth = el!.scrollWidth || 1;
      const naturalHeight = el!.scrollHeight || 1;
      setScale(Math.min(width / naturalWidth, height / naturalHeight, 1));
    }

    measure();
    // Images load asynchronously and change the content's natural height once
    // they do, so keep re-measuring as the (unscaled) layout box changes.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [html, width, height]);

  if (!html || width <= 0 || height <= 0) return null;

  return (
    <div className="note-card__preview" style={{ width, height }}>
      <div
        ref={innerRef}
        className="note-card__preview-content"
        style={{ width, transform: `scale(${scale})` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
