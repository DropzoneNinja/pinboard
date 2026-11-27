import type { BoardView } from '../services/types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Screen (client) coordinates -> world coordinates, given the viewport container's rect. */
export function screenToWorld(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  view: BoardView,
): { x: number; y: number } {
  return {
    x: (clientX - containerRect.left - view.viewportX) / view.zoomLevel,
    y: (clientY - containerRect.top - view.viewportY) / view.zoomLevel,
  };
}

/** Zoom by `factor`, keeping the world point under (clientX, clientY) stationary on screen. */
export function zoomAtPoint(
  view: BoardView,
  containerRect: DOMRect,
  clientX: number,
  clientY: number,
  factor: number,
): BoardView {
  const newZoom = clamp(view.zoomLevel * factor, MIN_ZOOM, MAX_ZOOM);
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  const worldX = (localX - view.viewportX) / view.zoomLevel;
  const worldY = (localY - view.viewportY) / view.zoomLevel;
  return {
    viewportX: localX - worldX * newZoom,
    viewportY: localY - worldY * newZoom,
    zoomLevel: newZoom,
  };
}

export function zoomAtCenter(view: BoardView, containerRect: DOMRect, factor: number): BoardView {
  return zoomAtPoint(
    view,
    containerRect,
    containerRect.left + containerRect.width / 2,
    containerRect.top + containerRect.height / 2,
    factor,
  );
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Centres the viewport on a note's midpoint, used when jumping to a search result. */
export function centerOnNote(
  note: { positionX: number; positionY: number; width: number; height: number },
  containerRect: DOMRect,
  zoomLevel = 1,
): BoardView {
  const centerX = note.positionX + note.width / 2;
  const centerY = note.positionY + note.height / 2;
  return {
    viewportX: containerRect.width / 2 - centerX * zoomLevel,
    viewportY: containerRect.height / 2 - centerY * zoomLevel,
    zoomLevel,
  };
}

/** The topmost note (by z-index) whose bounds contain the given world point, if any. */
export function noteAtPoint<
  T extends {
    id: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    zIndex: number;
  },
>(notes: T[], worldX: number, worldY: number): T | null {
  let best: T | null = null;
  for (const note of notes) {
    if (
      worldX < note.positionX ||
      worldX > note.positionX + note.width ||
      worldY < note.positionY ||
      worldY > note.positionY + note.height
    ) {
      continue;
    }
    if (!best || note.zIndex > best.zIndex) best = note;
  }
  return best;
}

export function fitAllView(boxes: BoundingBox[], containerRect: DOMRect, padding = 80): BoardView {
  if (boxes.length === 0) {
    return { viewportX: 0, viewportY: 0, zoomLevel: 1 };
  }
  const minX = Math.min(...boxes.map((b) => b.minX));
  const minY = Math.min(...boxes.map((b) => b.minY));
  const maxX = Math.max(...boxes.map((b) => b.maxX));
  const maxY = Math.max(...boxes.map((b) => b.maxY));

  const contentWidth = Math.max(maxX - minX, 1);
  const contentHeight = Math.max(maxY - minY, 1);
  const scaleX = (containerRect.width - padding * 2) / contentWidth;
  const scaleY = (containerRect.height - padding * 2) / contentHeight;
  const zoomLevel = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    viewportX: containerRect.width / 2 - centerX * zoomLevel,
    viewportY: containerRect.height / 2 - centerY * zoomLevel,
    zoomLevel,
  };
}
