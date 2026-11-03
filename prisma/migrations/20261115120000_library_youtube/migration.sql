-- Catalogue : démonstration YouTube intégrée (décision du fondateur,
-- 2026-11-02). La vidéo reste sur la chaîne de son créateur : on garde son
-- identifiant, l'extrait (début et fin, en secondes) et le nom de la chaîne
-- pour le crédit. Le lecteur ne se charge qu'au toucher (youtube-nocookie).
ALTER TABLE "library_items" ADD COLUMN "youtube_id" TEXT;
ALTER TABLE "library_items" ADD COLUMN "youtube_start" SMALLINT;
ALTER TABLE "library_items" ADD COLUMN "youtube_end" SMALLINT;
ALTER TABLE "library_items" ADD COLUMN "youtube_channel" TEXT;

-- Mêmes limites que src/features/library/rules.ts (un test le vérifie)
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_youtube_check" CHECK (
  (
    "youtube_id" IS NULL
    AND "youtube_start" IS NULL
    AND "youtube_end" IS NULL
    AND "youtube_channel" IS NULL
  )
  OR (
    "youtube_id" IS NOT NULL
    AND "youtube_id" ~ '^[A-Za-z0-9_-]{11}$'
    AND ("youtube_start" IS NULL OR "youtube_start" BETWEEN 0 AND 3600)
    AND ("youtube_end" IS NULL OR ("youtube_end" BETWEEN 1 AND 3600 AND "youtube_end" > COALESCE("youtube_start", 0)))
    AND ("youtube_channel" IS NULL OR char_length("youtube_channel") BETWEEN 1 AND 100)
  )
);
