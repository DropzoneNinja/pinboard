import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { asyncHandler } from '../services/http.js';
import { requireAuth } from '../auth/middleware.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

interface NoteSearchRow {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  contentType: string;
  updatedAt: Date;
}

interface BoardSearchRow {
  id: string;
  name: string;
}

const querySchema = z.object({ q: z.string().trim().min(1).max(200) });

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.json({ notes: [], boards: [] });
      return;
    }
    const { q } = parsed.data;

    // Only active (not archived/deleted) notes and boards are searched — archived notes have
    // their own dedicated view, and deleted items live in the recycle bin.
    const notes = await prisma.$queryRaw<NoteSearchRow[]>`
      SELECT n.id, n.title, n.board_id AS "boardId", b.name AS "boardName",
             n.content_type AS "contentType", n.updated_at AS "updatedAt"
      FROM notes n
      JOIN boards b ON b.id = n.board_id
      WHERE n.deleted_at IS NULL AND n.is_archived = false AND b.deleted_at IS NULL
        AND n.search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY n.updated_at DESC
      LIMIT 25
    `;

    const boards = await prisma.$queryRaw<BoardSearchRow[]>`
      SELECT id, name
      FROM boards
      WHERE deleted_at IS NULL AND is_archived = false
        AND search_vector @@ plainto_tsquery('english', ${q})
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    res.json({ notes, boards });
  }),
);
