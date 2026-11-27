import type { Board, Note, NoteConnection, PresenceUser } from './types';

/** Mirrors backend/src/websocket/types.ts — kept in sync by hand (no shared package between apps). */
export type ServerMessage =
  | { type: 'board:created'; board: Board }
  | { type: 'board:updated'; board: Board }
  | { type: 'board:archived'; board: Board }
  | { type: 'board:restored'; board: Board }
  | { type: 'board:deleted'; boardId: string }
  | { type: 'note:created'; note: Note }
  | { type: 'note:layout'; note: Note }
  | { type: 'note:content'; note: Note }
  | { type: 'note:archived'; noteId: string; boardId: string }
  | { type: 'note:restored'; note: Note }
  | { type: 'note:deleted'; noteId: string; boardId: string }
  | { type: 'note-connection:created'; connection: NoteConnection }
  | { type: 'note-connection:deleted'; connectionId: string; boardId: string }
  | { type: 'board:content_restored'; boardId: string }
  | { type: 'presence'; boardId: string; users: PresenceUser[] };

export type ClientMessage = { type: 'join' | 'leave'; boardId: string };
