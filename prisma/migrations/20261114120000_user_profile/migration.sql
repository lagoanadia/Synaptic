-- Profile: a public @handle and a drawn avatar (lib/avatar.ts).
-- IF NOT EXISTS: an earlier preview deploy may already have added them.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
