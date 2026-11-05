
-- CreateTable
CREATE TABLE "Debate" (
    "id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "url" TEXT,
    "source" TEXT,
    "motion" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'English',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "verdict" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Debate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debate_userId_createdAt_idx" ON "Debate"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Debate" ADD CONSTRAINT "Debate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
