-- Options blocks with columns you choose: a rating, a date and a note per option.
ALTER TABLE "Choice" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "Choice" ADD COLUMN IF NOT EXISTS "date" TEXT;
ALTER TABLE "Choice" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- Your own folder templates: a folder's blocks (and their columns), saved by name.
CREATE TABLE IF NOT EXISTS "UserTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserTemplate_userId_idx" ON "UserTemplate"("userId");
DO $$ BEGIN
  ALTER TABLE "UserTemplate" ADD CONSTRAINT "UserTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
