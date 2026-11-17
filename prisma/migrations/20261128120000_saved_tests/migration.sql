-- CreateTable
CREATE TABLE "SavedTest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'quiz',
    "pursuitId" TEXT,
    "unitId" TEXT,
    "items" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastScore" INTEGER,
    "bestScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SavedTest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedTest_userId_createdAt_idx" ON "SavedTest"("userId", "createdAt");
ALTER TABLE "SavedTest" ADD CONSTRAINT "SavedTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
