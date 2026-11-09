-- Événements de la Communauté (décision du fondateur, 2026-11-08) : un membre
-- du Centre propose une rencontre (en personne ou en ligne), les autres disent
-- « J'y vais » ou « Intéressé ». Limites alignées sur
-- src/features/community-events/rules.ts (un test le vérifie).

CREATE TYPE "CommunityEventFormat" AS ENUM ('in_person', 'online');
CREATE TYPE "EventAttendance" AS ENUM ('going', 'interested');

CREATE TABLE "community_events" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "topic" "Pillar",
    "format" "CommunityEventFormat" NOT NULL,
    "location" TEXT,
    "region" TEXT,
    "online_url" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "time_zone" TEXT NOT NULL,
    "capacity" INTEGER,
    "cover_path" TEXT,
    "cover_width" INTEGER,
    "cover_height" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_events_starts_at_idx" ON "community_events"("starts_at");
CREATE INDEX "community_events_host_id_starts_at_idx" ON "community_events"("host_id", "starts_at");

ALTER TABLE "community_events" ADD CONSTRAINT "community_events_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_events" ADD CONSTRAINT "community_events_check" CHECK (
  char_length("title") BETWEEN 3 AND 100
  AND char_length("description") <= 2000
  AND ("location" IS NULL OR char_length("location") BETWEEN 1 AND 200)
  AND ("online_url" IS NULL OR (char_length("online_url") <= 300 AND "online_url" LIKE 'https://%'))
  AND ("format" <> 'in_person' OR "location" IS NOT NULL)
  AND ("format" <> 'online' OR "online_url" IS NOT NULL)
  AND ("ends_at" IS NULL OR ("ends_at" > "starts_at" AND "ends_at" <= "starts_at" + INTERVAL '14 days'))
  AND ("capacity" IS NULL OR "capacity" BETWEEN 2 AND 10000)
  AND char_length("time_zone") BETWEEN 1 AND 64
);

CREATE TABLE "community_event_attendees" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "EventAttendance" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "community_event_attendees_pkey" PRIMARY KEY ("event_id", "user_id")
);

CREATE INDEX "community_event_attendees_user_id_idx" ON "community_event_attendees"("user_id");

ALTER TABLE "community_event_attendees" ADD CONSTRAINT "community_event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_attendees" ADD CONSTRAINT "community_event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Signaler un événement (masqué à 3 signalements, comme une publication)
ALTER TABLE "content_reports" ADD COLUMN "event_id" UUID;
CREATE UNIQUE INDEX "content_reports_reporter_id_event_id_key" ON "content_reports"("reporter_id", "event_id");
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_reports" DROP CONSTRAINT "content_reports_target_check";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_check" CHECK (
  num_nonnulls("post_id", "comment_id", "reported_user_id", "message_id", "story_id", "event_id") = 1
  AND ("details" IS NULL OR char_length("details") <= 500)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "community_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_event_attendees" ENABLE ROW LEVEL SECURITY;
