-- A true/false version of a card for the quiz: a short statement and
-- whether it's true.
ALTER TABLE "Flashcard" ADD COLUMN "tfStatement" TEXT;
ALTER TABLE "Flashcard" ADD COLUMN "tfTrue" BOOLEAN;
