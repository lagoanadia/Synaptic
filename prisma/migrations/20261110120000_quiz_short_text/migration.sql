-- Short versions of a card for the quiz: the question in a few words and
-- an answer of 2-6 words (the distractors match it).
ALTER TABLE "Flashcard" ADD COLUMN "quizQuestion" TEXT;
ALTER TABLE "Flashcard" ADD COLUMN "quizAnswer" TEXT;
