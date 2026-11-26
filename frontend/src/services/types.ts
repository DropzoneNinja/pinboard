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

export interface NoteAuthor {
  id: string;
  displayName: string;
  authorColour: string;
}

export type ContentType = 'text' | 'image' | 'table' | 'mixed';

export interface Note {
  id: string;
  boardId: string;
  title: string;
  content: unknown;
  contentType: ContentType;
  backgroundColour: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  createdBy: string;
  updatedBy: string;
  creator: NoteAuthor;
  updater: NoteAuthor;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  version: number;
}

export interface Attachment {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  uploadedBy: string;
}
