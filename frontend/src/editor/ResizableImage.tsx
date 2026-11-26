import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width, height } = node.attrs as {
    src: string;
    alt: string | null;
    width: number | null;
    height: number | null;
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  function handleResizeMouseDown(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const img = containerRef.current?.querySelector('img');
    if (!img) return;
    const startX = e.clientX;
    const startWidth = width ?? img.getBoundingClientRect().width;
    const aspectRatio = (height && width ? height / width : img.naturalHeight / img.naturalWidth) || 1;

    function handleMouseMove(moveEvent: MouseEvent) {
      const next = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setLiveWidth(next);
    }
    function handleMouseUp(upEvent: MouseEvent) {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const next = Math.max(60, startWidth + (upEvent.clientX - startX));
      setLiveWidth(null);
      updateAttributes({ width: Math.round(next), height: Math.round(next * aspectRatio) });
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`editor-image${selected ? ' editor-image--selected' : ''}`}
      ref={containerRef}
      style={{ display: 'inline-block', position: 'relative' }}
    >
      <img
        src={src}
        alt={alt ?? ''}
        width={liveWidth ?? width ?? undefined}
        height={liveWidth ? Math.round(liveWidth * ((height ?? 1) / (width ?? liveWidth))) : (height ?? undefined)}
        draggable={false}
      />
      <span className="editor-image__resize-handle" onMouseDown={handleResizeMouseDown} />
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
