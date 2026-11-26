export interface User {
  id: string;
  username: string;
  displayName: string;
  authorColour: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  backgroundStyle: string;
  backgroundColour: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  version: number;
}

export interface BoardView {
  viewportX: number;
  viewportY: number;
  zoomLevel: number;
}

export interface Note {
  id: string;
  boardId: string;
  title: string;
  content: unknown;
  contentType: string;
  backgroundColour: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  version: number;
}
