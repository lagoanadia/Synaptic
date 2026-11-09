-- Options blocks (links with a price, a state and votes) and budget lines,
-- for folders like a trip. blockId ties a row to its block in Pursuit.blocks.
CREATE TABLE "Choice" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "price" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Choice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Choice_pursuitId_blockId_idx" ON "Choice"("pursuitId", "blockId");
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChoiceVote" (
    "choiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChoiceVote_pkey" PRIMARY KEY ("choiceId", "userId")
);
ALTER TABLE "ChoiceVote" ADD CONSTRAINT "ChoiceVote_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "Choice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChoiceVote" ADD CONSTRAINT "ChoiceVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" INTEGER NOT NULL DEFAULT 0,
    "days" INTEGER NOT NULL DEFAULT 1,
    "perPerson" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BudgetLine_pursuitId_blockId_idx" ON "BudgetLine"("pursuitId", "blockId");
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A notebook's template: 'study', 'projects' or 'general' (null = from study).
ALTER TABLE "Section" ADD COLUMN "kind" TEXT;
