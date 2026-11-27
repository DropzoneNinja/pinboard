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

export interface NoteConnection {
  id: string;
  boardId: string;
  noteAId: string;
  noteBId: string;
  createdBy: string;
  createdAt: string;
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

export interface ActivityEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: NoteAuthor;
}

export interface AppSettings {
  id: string;
  defaultNoteColour: string;
  defaultNoteWidth: number;
  defaultNoteHeight: number;
  autosaveDebounceMs: number;
  recycleBinRetentionDays: number;
  dateTimeFormat: 'auto' | '12h' | '24h';
  updatedAt: string;
}

export interface BackupSettings {
  id: string;
  enabled: boolean;
  frequency: 'weekly' | 'monthly';
  retainCount: number;
  lastRunAt: string | null;
  updatedAt: string;
}

export type BackupKind = 'auto' | 'manual' | 'uploaded';

export interface BackupFileInfo {
  filename: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: string;
}

export interface Session {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
}

export interface RecycleBinNote extends Note {
  board: { id: string; name: string };
  expiresAt: string;
}

export interface RecycleBinBoard extends Board {
  expiresAt: string;
}

export interface SearchNoteResult {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  contentType: ContentType;
  updatedAt: string;
}

export interface SearchBoardResult {
  id: string;
  name: string;
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  authorColour: string;
}
