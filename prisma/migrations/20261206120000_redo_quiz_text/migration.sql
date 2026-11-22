-- The short quiz versions of the flashcards are rewritten with stricter
-- rules (about the concept, not an example's details; questions that stand
-- on their own; options that differ in their idea). Clearing them makes
-- each card get its new version the next time it comes up in Repasar. The
-- cards' own question and answer are kept.
UPDATE "Flashcard"
SET "quizQuestion" = NULL, "quizAnswer" = NULL, "distractors" = '{}', "tfStatement" = NULL, "tfTrue" = NULL, "hint" = NULL;
