-- AlterTable
ALTER TABLE "PursuitContentSection" ADD COLUMN "classroomUnit" TEXT;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "dumpId" TEXT;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dumpId_fkey" FOREIGN KEY ("dumpId") REFERENCES "BrainDump"("id") ON DELETE SET NULL ON UPDATE CASCADE;
