-- AlterTable
ALTER TABLE "ConceptMap" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "Pursuit" ADD COLUMN     "blocks" JSONB,
ADD COLUMN     "cover" TEXT,
ADD COLUMN     "groupLabel" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "cover" TEXT,
ADD COLUMN     "study" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeBlocks" JSONB;

-- AddForeignKey
ALTER TABLE "ConceptMap" ADD CONSTRAINT "ConceptMap_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PursuitContentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
