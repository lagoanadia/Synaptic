-- Generated columns: Postgres recomputes these automatically whenever
-- "content" changes, so search never re-tokenizes text at query time.
--
-- Using the 'simple' text search config on purpose, not 'spanish' or
-- 'english' — Synaptic's content mixes both languages freely (see the
-- brain dumps in this app), and a language-specific config stems words
-- using that language's grammar rules, which actively mismatches text
-- written in the other language. 'simple' just lowercases and splits on
-- word boundaries, no stemming — it won't match "organizando" when you
-- search "organizar", but it won't misfire on mixed-language text either.
ALTER TABLE "BrainDump" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;

CREATE INDEX "BrainDump_searchVector_idx" ON "BrainDump" USING GIN ("searchVector");

ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;

CREATE INDEX "Note_searchVector_idx" ON "Note" USING GIN ("searchVector");
