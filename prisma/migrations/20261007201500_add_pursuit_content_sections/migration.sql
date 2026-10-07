-- CreateTable
CREATE TABLE "PursuitContentSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pursuitId" TEXT NOT NULL,

    CONSTRAINT "PursuitContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PursuitContentSection_pursuitId_name_key" ON "PursuitContentSection"("pursuitId", "name");

-- AlterTable
ALTER TABLE "BrainDump" ADD COLUMN "sectionId" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "sectionId" TEXT;

-- AddForeignKey
ALTER TABLE "PursuitContentSection" ADD CONSTRAINT "PursuitContentSection_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainDump" ADD CONSTRAINT "BrainDump_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PursuitContentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PursuitContentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
