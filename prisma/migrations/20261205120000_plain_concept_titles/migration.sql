-- Concept and map titles are plain text: drop Markdown bold/code markers
-- the AI sometimes wrote into them ("Qué es **open source**").
UPDATE "Concept" SET "title" = btrim(regexp_replace("title", '\*\*|__|`', '', 'g')) WHERE "title" ~ '\*\*|__|`';
UPDATE "ConceptMap" SET "title" = btrim(regexp_replace("title", '\*\*|__|`', '', 'g')) WHERE "title" ~ '\*\*|__|`';
