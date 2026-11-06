
-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Debate" ADD COLUMN     "style" TEXT NOT NULL DEFAULT 'opponent';
