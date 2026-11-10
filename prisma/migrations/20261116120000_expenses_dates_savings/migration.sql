-- Gastos: who paid what; split between the folder's people.
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Expense_pursuitId_blockId_idx" ON "Expense"("pursuitId", "blockId");

-- Fechas: proposed days and who can make each.
CREATE TABLE IF NOT EXISTS "DateOption" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    CONSTRAINT "DateOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DateOption_pursuitId_blockId_idx" ON "DateOption"("pursuitId", "blockId");
CREATE TABLE IF NOT EXISTS "DateVote" (
    "dateOptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "DateVote_pkey" PRIMARY KEY ("dateOptionId", "userId")
);

-- Meta de ahorro: contributions towards the block's goal.
CREATE TABLE IF NOT EXISTS "Saving" (
    "id" TEXT NOT NULL,
    "pursuitId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Saving_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Saving_pursuitId_blockId_idx" ON "Saving"("pursuitId", "blockId");

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DateOption" ADD CONSTRAINT "DateOption_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DateVote" ADD CONSTRAINT "DateVote_dateOptionId_fkey" FOREIGN KEY ("dateOptionId") REFERENCES "DateOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DateVote" ADD CONSTRAINT "DateVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Saving" ADD CONSTRAINT "Saving_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Saving" ADD CONSTRAINT "Saving_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
