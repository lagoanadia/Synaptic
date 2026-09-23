-- AlterTable
ALTER TABLE "Pursuit" ADD COLUMN "sectionId" TEXT;

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_userId_name_key" ON "Section"("userId", "name");

-- AddForeignKey
ALTER TABLE "Pursuit" ADD CONSTRAINT "Pursuit_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
