-- Carnet d'entraînement (décision du fondateur, 2026-11-02) : pendant la séance
-- d'un plan d'entraînement, chaque série se note (poids, répétitions, faite ou
-- non). Une séance se retrouve par son jour et le jour de la semaine type.
-- Données privées : jamais montrées aux autres membres.
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID,
    "day" DATE NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "exercises" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "feeling" SMALLINT,
    "records" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_sessions_user_id_day_weekday_key" ON "workout_sessions"("user_id", "day", "weekday");
CREATE INDEX "workout_sessions_user_id_finished_at_idx" ON "workout_sessions"("user_id", "finished_at");

ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- L'historique appartient à la personne : il survit à la suppression du plan
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "development_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "exercise" TEXT NOT NULL,
    "library_item_id" UUID,
    "set_number" SMALLINT NOT NULL,
    "weight_grams" INTEGER,
    "reps" SMALLINT,
    "seconds" SMALLINT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workout_sets_session_id_position_set_number_key" ON "workout_sets"("session_id", "position", "set_number");
CREATE INDEX "workout_sets_library_item_id_idx" ON "workout_sets"("library_item_id");

ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_library_item_id_fkey" FOREIGN KEY ("library_item_id") REFERENCES "library_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mêmes limites que src/features/workouts/rules.ts (un test le vérifie)
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_check" CHECK (
  "weekday" BETWEEN 1 AND 7
  AND char_length("title") BETWEEN 1 AND 80
  AND ("feeling" IS NULL OR "feeling" BETWEEN 1 AND 5)
  AND ("finished_at" IS NULL OR "finished_at" >= "started_at")
);

ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_check" CHECK (
  "position" BETWEEN 0 AND 9
  AND "set_number" BETWEEN 1 AND 10
  AND char_length("exercise") >= 1
  AND ("weight_grams" IS NULL OR "weight_grams" BETWEEN 0 AND 1000000)
  AND ("reps" IS NULL OR "reps" BETWEEN 0 AND 500)
  AND ("seconds" IS NULL OR "seconds" BETWEEN 0 AND 3600)
);

-- Unité choisie à la première séance ; null : pas encore choisie
ALTER TABLE "user_settings" ADD COLUMN "weight_unit" TEXT;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_weight_unit_check" CHECK ("weight_unit" IS NULL OR "weight_unit" IN ('kg', 'lb'));

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "workout_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout_sets" ENABLE ROW LEVEL SECURITY;
