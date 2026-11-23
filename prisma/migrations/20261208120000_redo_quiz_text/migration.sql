-- The multiple-choice versions are rewritten with the better prompt: clear
-- them so each card gets a new one the next time it's reviewed.
UPDATE "Flashcard" SET "quizQuestion" = NULL, "quizAnswer" = NULL, "distractors" = '{}', "tfStatement" = NULL, "tfTrue" = NULL;
