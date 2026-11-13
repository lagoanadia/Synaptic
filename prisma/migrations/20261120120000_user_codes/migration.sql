-- "Programo": shows Retos (coding challenges). On for whoever already has some.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "codes" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" u SET "codes" = true WHERE EXISTS (SELECT 1 FROM "Challenge" c WHERE c."userId" = u.id);
