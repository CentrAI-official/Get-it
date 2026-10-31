-- Studio des stories, comme Instagram et Facebook : textes, emoji et stickers
-- posés sur le média, musique du catalogue Get iT (libre de droits), sondage et
-- question, liste « Vu par » pour l'auteur, réponses dans la Messagerie.

-- Catalogue de musique (ajouté par l'équipe Get iT, rôle admin)
CREATE TABLE "music_tracks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "moods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pillars" "Pillar"[] DEFAULT ARRAY[]::"Pillar"[],
    "path" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "license" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "added_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "music_tracks_active_created_at_idx" ON "music_tracks"("active", "created_at");

ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mêmes limites que src/features/stories/music.ts (un test le vérifie)
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_check" CHECK (
  char_length("title") BETWEEN 1 AND 100
  AND char_length("artist") BETWEEN 1 AND 100
  AND char_length("license") BETWEEN 1 AND 300
  AND cardinality("moods") <= 8
  AND "duration_ms" BETWEEN 5000 AND 600000
  AND "size_bytes" BETWEEN 1 AND 20971520
);

-- Stories : textes et stickers (JSON revalidé à la lecture), musique et extrait
ALTER TABLE "stories" ADD COLUMN "overlays" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "stories" ADD COLUMN "music_track_id" UUID;
ALTER TABLE "stories" ADD COLUMN "music_start_ms" INTEGER;
ALTER TABLE "stories" ADD CONSTRAINT "stories_music_track_id_fkey" FOREIGN KEY ("music_track_id") REFERENCES "music_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "stories_music_track_id_created_at_idx" ON "stories"("music_track_id", "created_at");
ALTER TABLE "stories" ADD CONSTRAINT "stories_studio_check" CHECK (
  jsonb_typeof("overlays") = 'array'
  AND jsonb_array_length("overlays") <= 20
  AND ("music_start_ms" IS NULL OR "music_start_ms" >= 0)
);

-- « Vu par » : une ligne par personne et par story
CREATE TABLE "story_views" (
    "story_id" UUID NOT NULL,
    "viewer_id" UUID NOT NULL,
    "viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_views_pkey" PRIMARY KEY ("story_id", "viewer_id")
);
CREATE INDEX "story_views_viewer_id_idx" ON "story_views"("viewer_id");
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sondage : un vote par personne
CREATE TABLE "story_poll_votes" (
    "story_id" UUID NOT NULL,
    "voter_id" UUID NOT NULL,
    "choice" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_poll_votes_pkey" PRIMARY KEY ("story_id", "voter_id"),
    CONSTRAINT "story_poll_votes_choice_check" CHECK ("choice" IN (0, 1))
);
CREATE INDEX "story_poll_votes_voter_id_idx" ON "story_poll_votes"("voter_id");
ALTER TABLE "story_poll_votes" ADD CONSTRAINT "story_poll_votes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_poll_votes" ADD CONSTRAINT "story_poll_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Question : une réponse par personne, lue par l'auteur seulement
CREATE TABLE "story_answers" (
    "id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "story_answers_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "story_answers_story_id_author_id_key" ON "story_answers"("story_id", "author_id");
CREATE INDEX "story_answers_author_id_idx" ON "story_answers"("author_id");
ALTER TABLE "story_answers" ADD CONSTRAINT "story_answers_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_answers" ADD CONSTRAINT "story_answers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Réponse à une story dans la Messagerie (aperçu tant que la story existe)
ALTER TABLE "messages" ADD COLUMN "story_id" UUID;
ALTER TABLE "messages" ADD CONSTRAINT "messages_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "messages_story_id_idx" ON "messages"("story_id");
ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (
  char_length("body") <= 2000
  AND "media_count" BETWEEN 0 AND 4
  AND ("media_count" = 0 OR "kind" = 'text')
  AND ("kind" = 'post' OR "post_id" IS NULL)
  AND ("kind" = 'story' OR "story_id" IS NULL)
  AND (
    "deleted_at" IS NOT NULL
    OR ("kind" = 'text' AND (char_length(btrim("body")) > 0 OR "media_count" > 0) AND "progress" IS NULL AND "pact_id" IS NULL)
    OR ("kind" = 'progress' AND "progress" IS NOT NULL AND "pact_id" IS NULL)
    OR ("kind" = 'pact' AND "pact_id" IS NOT NULL AND "body" IN ('proposed', 'ended', 'cancelled'))
    OR ("kind" = 'post' AND "progress" IS NULL AND "pact_id" IS NULL)
    OR ("kind" = 'story' AND char_length(btrim("body")) > 0 AND "progress" IS NULL AND "pact_id" IS NULL)
  )
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "music_tracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "story_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "story_poll_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "story_answers" ENABLE ROW LEVEL SECURITY;
