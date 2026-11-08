-- AlterTable
ALTER TABLE "Pursuit" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProjectCardStatus" NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pursuitId" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_pursuitId_status_idx" ON "Task"("pursuitId", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
