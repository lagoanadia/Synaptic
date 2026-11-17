-- AlterTable
ALTER TABLE "Section" ADD COLUMN "groups" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Pursuit" ADD COLUMN "group" TEXT;
