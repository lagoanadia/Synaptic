-- AlterTable
ALTER TABLE "DriveSource" ADD COLUMN     "noteId" TEXT,
ADD COLUMN     "pageError" TEXT,
ADD COLUMN     "pageStatus" TEXT,
ADD COLUMN     "text" TEXT;

-- CreateIndex
CREATE INDEX "DriveSource_userId_pageStatus_idx" ON "DriveSource"("userId", "pageStatus");
