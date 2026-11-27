import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';

type Client = Pick<Prisma.TransactionClient, '$executeRaw'>;

/**
 * `search_vector` on notes/boards is a plain tsvector column (not a Postgres generated column),
 * kept in sync from application code whenever the indexed text changes. Simpler than a STORED
 * generated column, and Prisma Client can't write `Unsupported` columns directly anyway.
 *
 * Takes an optional client so callers running inside a transaction (e.g. a backup restore) can
 * pass their `tx` — raw queries against the default `prisma` client run on a separate connection
 * and wouldn't see not-yet-committed rows from that transaction.
 */
export async function syncNoteSearchVector(
  noteId: string,
  title: string,
  searchText: string,
  client: Client = prisma,
): Promise<void> {
  await client.$executeRaw`
    UPDATE notes
    SET search_vector = to_tsvector('english', coalesce(${title}, '') || ' ' || coalesce(${searchText}, ''))
    WHERE id = ${noteId}::uuid
  `;
}

export async function syncBoardSearchVector(
  boardId: string,
  name: string,
  description: string | null,
  client: Client = prisma,
): Promise<void> {
  await client.$executeRaw`
    UPDATE boards
    SET search_vector = to_tsvector('english', coalesce(${name}, '') || ' ' || coalesce(${description}, ''))
    WHERE id = ${boardId}::uuid
  `;
}
