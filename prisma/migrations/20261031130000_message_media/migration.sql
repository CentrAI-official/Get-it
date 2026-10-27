-- Photos et vidéos des messages privés : mêmes limites que les publications
-- (4 photos ou 1 vidéo), fichiers privés du compartiment « media », supprimés
-- avec le message (ou le compte de l'expéditeur).
ALTER TABLE "messages" ADD COLUMN "media_count" SMALLINT NOT NULL DEFAULT 0;

CREATE TABLE "message_media" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "path" TEXT NOT NULL,
    "poster_path" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_media_path_key" ON "message_media"("path");
CREATE INDEX "message_media_message_id_position_idx" ON "message_media"("message_id", "position");

ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_media" ADD CONSTRAINT "message_media_shape_check" CHECK (
  "position" BETWEEN 0 AND 3
  AND "width" > 0 AND "height" > 0
  AND "size_bytes" > 0 AND "size_bytes" <= 52428800
  AND (("kind" = 'video') = ("duration_ms" IS NOT NULL))
  AND ("duration_ms" IS NULL OR "duration_ms" <= 61000)
);

-- Un message texte peut n'avoir que des photos ; seuls les messages texte en ont
ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (
  char_length("body") <= 2000
  AND "media_count" BETWEEN 0 AND 4
  AND ("media_count" = 0 OR "kind" = 'text')
  AND ("kind" = 'post' OR "post_id" IS NULL)
  AND (
    "deleted_at" IS NOT NULL
    OR ("kind" = 'text' AND (char_length(btrim("body")) > 0 OR "media_count" > 0) AND "progress" IS NULL AND "pact_id" IS NULL)
    OR ("kind" = 'progress' AND "progress" IS NOT NULL AND "pact_id" IS NULL)
    OR ("kind" = 'pact' AND "pact_id" IS NOT NULL AND "body" IN ('proposed', 'ended', 'cancelled'))
    OR ("kind" = 'post' AND "progress" IS NULL AND "pact_id" IS NULL)
  )
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "message_media" ENABLE ROW LEVEL SECURITY;
