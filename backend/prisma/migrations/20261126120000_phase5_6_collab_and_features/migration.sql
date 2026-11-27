-- AlterTable
ALTER TABLE "boards" ADD COLUMN "search_vector" tsvector;

-- AlterTable
ALTER TABLE "notes" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN "search_vector" tsvector;

-- Backfill existing rows (title only for now; content text is recomputed on the next save
-- by notes/searchVector.ts, so this is just a reasonable starting point, not a full backfill).
UPDATE "boards" SET "search_vector" = to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", ''));
UPDATE "notes" SET "search_vector" = to_tsvector('english', coalesce("title", ''));

-- CreateIndex
CREATE INDEX "boards_search_vector_idx" ON "boards" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "board_id" UUID,
    "note_id" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_board_id_idx" ON "activity_log"("board_id");

-- CreateIndex
CREATE INDEX "activity_log_note_id_idx" ON "activity_log"("note_id");

-- CreateIndex
CREATE INDEX "activity_log_user_id_idx" ON "activity_log"("user_id");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "default_note_colour" TEXT NOT NULL DEFAULT 'yellow',
    "default_note_width" DOUBLE PRECISION NOT NULL DEFAULT 220,
    "default_note_height" DOUBLE PRECISION NOT NULL DEFAULT 220,
    "autosave_debounce_ms" INTEGER NOT NULL DEFAULT 700,
    "recycle_bin_retention_days" INTEGER NOT NULL DEFAULT 30,
    "date_time_format" TEXT NOT NULL DEFAULT 'auto',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
