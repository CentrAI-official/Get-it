-- Photos et vidéos d'une page du journal (fichiers privés du compartiment
-- « media »). Rattachées au jour, pas au texte : vider la page ne les efface pas.
CREATE TABLE "journal_media" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "poster_path" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journal_media_path_key" ON "journal_media"("path");

-- Une place par média : 4 au plus par page (positions 0 à 3)
CREATE UNIQUE INDEX "journal_media_user_id_day_position_key" ON "journal_media"("user_id", "day", "position");

ALTER TABLE "journal_media" ADD CONSTRAINT "journal_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mêmes garanties que les médias des publications
ALTER TABLE "journal_media" ADD CONSTRAINT "journal_media_shape_check" CHECK (
  "position" BETWEEN 0 AND 3
  AND "width" > 0 AND "height" > 0
  AND "size_bytes" > 0 AND "size_bytes" <= 52428800
  AND (("kind" = 'video') = ("duration_ms" IS NOT NULL))
  AND ("duration_ms" IS NULL OR "duration_ms" <= 61000)
  AND char_length("path") BETWEEN 1 AND 300
  AND ("poster_path" IS NULL OR char_length("poster_path") BETWEEN 1 AND 300)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "journal_media" ENABLE ROW LEVEL SECURITY;
