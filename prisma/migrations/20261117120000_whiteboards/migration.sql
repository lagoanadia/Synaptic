-- Whiteboards inside pages: strokes, shapes and text as JSON.
CREATE TABLE IF NOT EXISTS "Whiteboard" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Whiteboard_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
