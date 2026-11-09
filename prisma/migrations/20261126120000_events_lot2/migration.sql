-- Événements, lot 2 (décision du fondateur, 2026-11-08) : au nom d'une page
-- pro ou dans un groupe, la discussion de l'événement et le rappel 24 h avant.
-- Limites alignées sur src/features/community-events/rules.ts (un test le vérifie).

-- Au nom d'une page pro, ou dans un groupe (jamais les deux)
ALTER TABLE "community_events" ADD COLUMN "page_id" UUID;
ALTER TABLE "community_events" ADD COLUMN "group_id" UUID;
-- Rappel envoyé aux inscrits (null : pas encore)
ALTER TABLE "community_events" ADD COLUMN "reminded_at" TIMESTAMPTZ(3);
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_owner_check" CHECK ("page_id" IS NULL OR "group_id" IS NULL);
CREATE INDEX "community_events_page_id_starts_at_idx" ON "community_events"("page_id", "starts_at");
CREATE INDEX "community_events_group_id_starts_at_idx" ON "community_events"("group_id", "starts_at");
-- Les rappels à envoyer (tâche planifiée)
CREATE INDEX "community_events_reminded_at_starts_at_idx" ON "community_events"("reminded_at", "starts_at");

-- La discussion d'un événement
CREATE TABLE "community_event_comments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "page_id" UUID,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_event_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_event_comments_event_id_created_at_idx" ON "community_event_comments"("event_id", "created_at");
CREATE INDEX "community_event_comments_user_id_created_at_idx" ON "community_event_comments"("user_id", "created_at");

ALTER TABLE "community_event_comments" ADD CONSTRAINT "community_event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_comments" ADD CONSTRAINT "community_event_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_comments" ADD CONSTRAINT "community_event_comments_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_comments" ADD CONSTRAINT "community_event_comments_check" CHECK (char_length("body") BETWEEN 1 AND 1000);

-- Signaler un message de la discussion
ALTER TABLE "content_reports" ADD COLUMN "event_comment_id" UUID;
CREATE UNIQUE INDEX "content_reports_reporter_id_event_comment_id_key" ON "content_reports"("reporter_id", "event_comment_id");
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_event_comment_id_fkey" FOREIGN KEY ("event_comment_id") REFERENCES "community_event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_reports" DROP CONSTRAINT "content_reports_target_check";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_check" CHECK (
  num_nonnulls("post_id", "comment_id", "reported_user_id", "message_id", "story_id", "event_id", "event_comment_id") = 1
  AND ("details" IS NULL OR char_length("details") <= 500)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "community_event_comments" ENABLE ROW LEVEL SECURITY;
