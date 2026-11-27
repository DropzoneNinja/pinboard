import type { Board, Note, NoteConnection } from '@prisma/client';

export type NoteWithAuthors = Note & {
  creator: { id: string; displayName: string; authorColour: string };
  updater: { id: string; displayName: string; authorColour: string };
};

export interface PresenceUser {
  userId: string;
  displayName: string;
  authorColour: string;
}

/** Client -> server messages. */
export type ClientMessage = { type: 'join'; boardId: string } | { type: 'leave'; boardId: string };

/**
 * Server -> client messages. `board:*` events are broadcast to every connected client (the board
 * list is global and small); `note:*` and `presence` events are scoped to clients that joined
 * that board's room. Layout events (position/size/z-index/colour) are kept separate from content
 * events (title/body) per PROJECT.md §19.
 */
export type ServerMessage =
  | { type: 'board:created'; board: Board }
  | { type: 'board:updated'; board: Board }
  | { type: 'board:archived'; board: Board }
  | { type: 'board:restored'; board: Board }
  | { type: 'board:deleted'; boardId: string }
  | { type: 'note:created'; note: NoteWithAuthors }
  | { type: 'note:layout'; note: NoteWithAuthors }
  | { type: 'note:content'; note: NoteWithAuthors }
  | { type: 'note:archived'; noteId: string; boardId: string }
  | { type: 'note:restored'; note: NoteWithAuthors }
  | { type: 'note:deleted'; noteId: string; boardId: string }
  | { type: 'note-connection:created'; connection: NoteConnection }
  | { type: 'note-connection:deleted'; connectionId: string; boardId: string }
  | { type: 'board:content_restored'; boardId: string }
  | { type: 'presence'; boardId: string; users: PresenceUser[] };
