-- Niveaux mesurés (décision du fondateur, 2026-11-01) : chaque mesure est
-- gardée à part, le niveau d'un pilier est sa mesure la plus faible, et seuls
-- les objectifs de niveau (calculés d'après la population) font monter.

-- Objectif personnel ou objectif de niveau
CREATE TYPE "GoalKind" AS ENUM ('personal', 'level');

ALTER TABLE "goals"
    ADD COLUMN "kind" "GoalKind" NOT NULL DEFAULT 'personal',
    ADD COLUMN "level_factor" TEXT,
    ADD COLUMN "level_target" DOUBLE PRECISION,
    ADD COLUMN "level" SMALLINT;

-- Un objectif de niveau nomme sa mesure, sa valeur et son niveau ; un objectif
-- personnel n'en a pas. Mesures alignées sur src/features/levels/factors.ts
-- (un test le vérifie).
ALTER TABLE "goals" ADD CONSTRAINT "goals_level_check" CHECK (
    ("kind" = 'personal' AND "level_factor" IS NULL AND "level_target" IS NULL AND "level" IS NULL)
    OR ("kind" = 'level'
        AND "level_factor" IN ('run', 'pushUps', 'reach', 'squats', 'jump', 'bench', 'hourly', 'netWorth', 'savings')
        AND "level_target" IS NOT NULL
        AND "level" BETWEEN 2 AND 100)
);

-- Un seul objectif de niveau en cours par personne et par mesure
CREATE UNIQUE INDEX "goals_level_factor_active_key" ON "goals"("user_id", "level_factor")
    WHERE "kind" = 'level' AND "status" = 'active';

-- Mode Ranked : niveaux publics et classement, depuis ce moment
ALTER TABLE "profiles" ADD COLUMN "ranked_at" TIMESTAMPTZ(3);

-- Mesures : une ligne par test ou déclaration ; effacées avec le compte
CREATE TABLE "measurements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "factor" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "details" JSONB,
    "measured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "measurements_factor_check" CHECK ("factor" IN ('run', 'pushUps', 'reach', 'squats', 'jump', 'bench', 'hourly', 'netWorth', 'savings'))
);
CREATE INDEX "measurements_user_id_factor_measured_at_idx" ON "measurements"("user_id", "factor", "measured_at" DESC);
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La clé publique de Supabase ne lit rien : tout passe par le serveur
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;

-- Les évaluations Ranked deviennent des mesures (la plus récente de chaque
-- personne). L'IMC disparaît ; le développé couché reste à mesurer.
WITH "latest" AS (
    SELECT DISTINCT ON ("user_id") "user_id", "answers" AS a, "created_at"
    FROM "ranked_evaluations"
    ORDER BY "user_id", "created_at" DESC
)
INSERT INTO "measurements" ("id", "user_id", "factor", "value", "details", "measured_at")
SELECT gen_random_uuid(), l."user_id", f."factor", f."value", f."details", l."created_at"
FROM "latest" l
CROSS JOIN LATERAL (VALUES
    ('run', (l.a->>'runMeters')::float8,
        jsonb_build_object('runMeters', (l.a->>'runMeters')::float8)),
    ('pushUps', (l.a->>'pushUps')::float8,
        jsonb_build_object('pushUps', (l.a->>'pushUps')::float8)),
    ('reach',
        CASE WHEN l.a->>'reachSide' = 'beyond' THEN 1 ELSE -1 END * (l.a->>'reachCm')::float8,
        jsonb_build_object('reachSide', l.a->>'reachSide', 'reachCm', (l.a->>'reachCm')::float8)),
    ('squats', (l.a->>'squats')::float8,
        jsonb_build_object('squats', (l.a->>'squats')::float8)),
    ('jump', (l.a->>'jumpCm')::float8,
        jsonb_build_object('jumpCm', (l.a->>'jumpCm')::float8)),
    -- Sans heures de travail : le revenu ramené à un temps plein (40 h)
    ('hourly',
        (l.a->>'netIncome')::float8
            / (COALESCE(NULLIF((l.a->>'weeklyHours')::float8, 0), 40) * 52),
        jsonb_build_object('netIncome', (l.a->>'netIncome')::float8, 'weeklyHours', (l.a->>'weeklyHours')::float8)),
    ('netWorth', (l.a->>'assets')::float8 - (l.a->>'debts')::float8,
        jsonb_build_object('assets', (l.a->>'assets')::float8, 'debts', (l.a->>'debts')::float8)),
    ('savings',
        CASE
            WHEN (l.a->>'netIncome')::float8 <= 0
                THEN CASE WHEN (l.a->>'monthlyExpenses')::float8 > 0 THEN -1 ELSE 0 END
            ELSE GREATEST(-1, LEAST(1,
                ((l.a->>'netIncome')::float8 - 12 * (l.a->>'monthlyExpenses')::float8)
                    / (l.a->>'netIncome')::float8))
        END,
        jsonb_build_object('netIncome', (l.a->>'netIncome')::float8, 'monthlyExpenses', (l.a->>'monthlyExpenses')::float8))
) AS f("factor", "value", "details")
WHERE l.a ? 'runMeters';

-- Les personnes déjà en Ranked le restent
UPDATE "profiles" p
SET "ranked_at" = r."first_at"
FROM (
    SELECT "user_id", MIN("created_at") AS "first_at"
    FROM "ranked_evaluations"
    GROUP BY "user_id"
) r
WHERE p."id" = r."user_id";
