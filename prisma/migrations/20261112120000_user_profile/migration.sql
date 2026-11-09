-- Profile: a public @handle and a drawn avatar (lib/avatar.ts).
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar" JSONB;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
