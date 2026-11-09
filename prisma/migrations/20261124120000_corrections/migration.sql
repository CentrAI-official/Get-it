-- Corrections du 2026-11-08 (demandes du fondateur). Seulement des ajouts et
-- des contraintes élargies : la version en ligne continue de fonctionner.

-- Langue d'un plan de Mon développement (« Traduire ce plan ») ; null : plans
-- créés avant, leur langue est devinée d'après leurs mots
ALTER TABLE "development_plans" ADD COLUMN "locale" TEXT;
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_locale_check" CHECK ("locale" IS NULL OR "locale" IN ('fr', 'en'));

-- Textes et emoji posés sur une photo ou la vidéo d'une publication, comme sur
-- une story (20 au plus, revalidés par postOverlaysSchema)
ALTER TABLE "post_media" ADD COLUMN "overlays" JSONB;
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_overlays_check" CHECK ("overlays" IS NULL OR (jsonb_typeof("overlays") = 'array' AND jsonb_array_length("overlays") <= 20));

-- Calendrier personnel : un événement peut n'avoir pas de fin, durer jusqu'à un
-- an (plus 14 jours) et avoir une adresse complète (200 caractères), mêmes
-- limites que src/features/events/rules.ts (un test le vérifie)
ALTER TABLE "calendar_events" ALTER COLUMN "ends_on" DROP NOT NULL;
ALTER TABLE "calendar_events" ALTER COLUMN "end_minute" DROP NOT NULL;
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_check";
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_check" CHECK (
  char_length("title") BETWEEN 1 AND 120
  AND ("location" IS NULL OR char_length("location") BETWEEN 1 AND 200)
  AND "start_minute" BETWEEN 0 AND 1439
  AND (
    ("ends_on" IS NULL AND "end_minute" IS NULL)
    OR (
      "ends_on" IS NOT NULL
      AND "end_minute" IS NOT NULL
      AND "end_minute" BETWEEN 0 AND 1439
      AND ("ends_on" > "starts_on" OR ("ends_on" = "starts_on" AND "end_minute" > "start_minute"))
      AND "ends_on" <= "starts_on" + 366
    )
  )
);
