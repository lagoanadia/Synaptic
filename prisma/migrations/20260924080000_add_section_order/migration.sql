-- AlterTable
ALTER TABLE "Section" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing sections with a stable order per user (alphabetical,
-- matching how they were sorted before this column existed) so nothing
-- visibly reshuffles on deploy.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY name ASC) - 1 AS rn
  FROM "Section"
)
UPDATE "Section" SET "order" = ranked.rn
FROM ranked
WHERE "Section".id = ranked.id;
