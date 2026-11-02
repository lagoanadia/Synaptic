-- The onboardedAt column (20261009130000_add_user_onboarded_at) was added
-- with no default, so every account that existed before that migration —
-- which is every real user of this app so far — got NULL, the same value
-- that means "still show the first-run tour". Anyone who already owns a
-- Pursuit is obviously not a first-time user; mark them onboarded so the
-- tour stops trying to render on their Brain Dump tab. A genuinely new
-- signup (owns nothing yet) is left NULL on purpose, so they still see it.
UPDATE "User"
SET "onboardedAt" = NOW()
WHERE "onboardedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Pursuit" WHERE "Pursuit"."ownerId" = "User"."id"
  );
