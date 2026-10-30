-- Calendrier personnel : les événements de la personne (job, souper, cuisiner
-- les lunchs…), privés et sans XP. Jours et heures tels qu'affichés, dans le
-- fuseau de la personne : un événement répété reste à la même heure toute l'année.
CREATE TYPE "EventRepeat" AS ENUM ('none', 'daily', 'every_two_days', 'weekdays', 'weekends', 'weekly', 'monthly');

CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "starts_on" DATE NOT NULL,
    "start_minute" SMALLINT NOT NULL,
    "ends_on" DATE NOT NULL,
    "end_minute" SMALLINT NOT NULL,
    "repeat" "EventRepeat" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_events_user_id_starts_on_idx" ON "calendar_events"("user_id", "starts_on");

ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mêmes limites que src/features/events/rules.ts (un test le vérifie)
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_check" CHECK (
  char_length("title") BETWEEN 1 AND 120
  AND ("location" IS NULL OR char_length("location") BETWEEN 1 AND 120)
  AND "start_minute" BETWEEN 0 AND 1439
  AND "end_minute" BETWEEN 0 AND 1439
  AND ("ends_on" > "starts_on" OR ("ends_on" = "starts_on" AND "end_minute" > "start_minute"))
  AND "ends_on" <= "starts_on" + 14
);

-- Heure choisie en faisant sa part d'un pacte (minutes depuis minuit, dans le
-- fuseau de la personne) ; null : l'heure de la coche
ALTER TABLE "habit_completions" ADD COLUMN "done_minute" SMALLINT;
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_done_minute_check" CHECK ("done_minute" IS NULL OR "done_minute" BETWEEN 0 AND 1439);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
