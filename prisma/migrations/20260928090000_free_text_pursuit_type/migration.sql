-- AlterTable: type goes from a required PursuitType enum + optional
-- customType to a single optional free-text column, matching Section.
ALTER TABLE "Pursuit" ADD COLUMN "type_new" TEXT;

-- Backfill: OTHER rows keep whatever custom name was already typed;
-- the four fixed values become their plain display text.
UPDATE "Pursuit" SET "type_new" = CASE
  WHEN "type" = 'OTHER' THEN "customType"
  WHEN "type" = 'PROJECT' THEN 'Project'
  WHEN "type" = 'BOOK' THEN 'Book'
  WHEN "type" = 'LANGUAGE' THEN 'Language'
  WHEN "type" = 'SKILL' THEN 'Skill'
  ELSE NULL
END;

ALTER TABLE "Pursuit" DROP COLUMN "type";
ALTER TABLE "Pursuit" DROP COLUMN "customType";
ALTER TABLE "Pursuit" RENAME COLUMN "type_new" TO "type";

DROP TYPE "PursuitType";
