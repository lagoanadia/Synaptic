-- Repasar's rewards: ✦ balance and the avatar costumes bought with it.
ALTER TABLE "User" ADD COLUMN "stars" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "costumes" TEXT[] DEFAULT ARRAY[]::TEXT[];
