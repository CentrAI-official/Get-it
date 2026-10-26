-- Le journal devient une page de texte libre. Les réponses aux anciennes
-- questions guidées rejoignent d'abord le texte de leur page (précédées du nom
-- de la question, dans la langue de la personne), pour ne rien perdre.
UPDATE "journal_entries" AS e
SET "body" = concat_ws(
      E'\n\n',
      CASE WHEN e."gratitude" IS NOT NULL THEN
        (CASE WHEN s."locale" = 'en' THEN 'Gratitude: ' ELSE U&'Gratitude\00A0: ' END) || e."gratitude" END,
      CASE WHEN e."win" IS NOT NULL THEN
        (CASE WHEN s."locale" = 'en' THEN U&'Today\2019s win: ' ELSE U&'Victoire du jour\00A0: ' END) || e."win" END,
      CASE WHEN e."lesson" IS NOT NULL THEN
        (CASE WHEN s."locale" = 'en' THEN 'Lesson or challenge: ' ELSE U&'Le\00E7on ou d\00E9fi\00A0: ' END) || e."lesson" END,
      CASE WHEN e."intention" IS NOT NULL THEN
        (CASE WHEN s."locale" = 'en' THEN 'Intention for tomorrow: ' ELSE U&'Intention pour demain\00A0: ' END) || e."intention" END,
      e."body"
    )
FROM "user_settings" AS s
WHERE s."user_id" = e."user_id"
  AND num_nonnulls(e."gratitude", e."win", e."lesson", e."intention") > 0;

-- Pages sans réglages de langue (ne devrait pas arriver) : libellés français
UPDATE "journal_entries" AS e
SET "body" = concat_ws(
      E'\n\n',
      CASE WHEN e."gratitude" IS NOT NULL THEN U&'Gratitude\00A0: ' || e."gratitude" END,
      CASE WHEN e."win" IS NOT NULL THEN U&'Victoire du jour\00A0: ' || e."win" END,
      CASE WHEN e."lesson" IS NOT NULL THEN U&'Le\00E7on ou d\00E9fi\00A0: ' || e."lesson" END,
      CASE WHEN e."intention" IS NOT NULL THEN U&'Intention pour demain\00A0: ' || e."intention" END,
      e."body"
    )
WHERE num_nonnulls(e."gratitude", e."win", e."lesson", e."intention") > 0
  AND NOT EXISTS (SELECT 1 FROM "user_settings" AS s WHERE s."user_id" = e."user_id");

-- Mots recalculés pour les pages regroupées
UPDATE "journal_entries"
SET "words" = coalesce(array_length(regexp_split_to_array(btrim("body"), '\s+'), 1), 0)
WHERE "body" IS NOT NULL AND btrim("body") <> '';

-- AlterTable
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_text_check";
ALTER TABLE "journal_entries" DROP COLUMN "gratitude",
DROP COLUMN "intention",
DROP COLUMN "lesson",
DROP COLUMN "win",
ALTER COLUMN "body" SET NOT NULL;

-- Limite de src/features/journal/rules.ts ; une page vidée est supprimée (jamais vide)
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_body_check" CHECK (
  char_length("body") BETWEEN 1 AND 10000
);
