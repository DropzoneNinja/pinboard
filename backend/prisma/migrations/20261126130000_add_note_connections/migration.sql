-- CreateTable
CREATE TABLE "note_connections" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "note_a_id" UUID NOT NULL,
    "note_b_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_connections_board_id_idx" ON "note_connections"("board_id");

-- CreateIndex
CREATE INDEX "note_connections_note_b_id_idx" ON "note_connections"("note_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_connections_note_a_id_note_b_id_key" ON "note_connections"("note_a_id", "note_b_id");

-- AddForeignKey
ALTER TABLE "note_connections" ADD CONSTRAINT "note_connections_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_connections" ADD CONSTRAINT "note_connections_note_a_id_fkey" FOREIGN KEY ("note_a_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_connections" ADD CONSTRAINT "note_connections_note_b_id_fkey" FOREIGN KEY ("note_b_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_connections" ADD CONSTRAINT "note_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
