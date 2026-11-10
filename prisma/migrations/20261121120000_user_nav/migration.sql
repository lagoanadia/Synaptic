-- Which optional menu items you hide or show (calendar, review). Null = defaults.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nav" JSONB;
