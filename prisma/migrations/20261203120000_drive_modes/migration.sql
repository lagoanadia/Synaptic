-- AlterTable
ALTER TABLE "DriveAgent" ADD COLUMN     "mode" TEXT,
ADD COLUMN     "stats" JSONB;

-- AlterTable
ALTER TABLE "DriveSource" ADD COLUMN     "hint" TEXT;
