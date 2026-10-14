-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('habit_day', 'task', 'milestone', 'goal', 'check_in');

-- CreateTable
CREATE TABLE "xp_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" "XpSource" NOT NULL,
    "amount" SMALLINT NOT NULL,
    "pillar" "Pillar",
    "day" DATE NOT NULL,
    "habit_completion_id" UUID,
    "task_id" UUID,
    "milestone_id" UUID,
    "goal_id" UUID,
    "check_in_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_habit_completion_id_key" ON "xp_events"("habit_completion_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_task_id_key" ON "xp_events"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_milestone_id_key" ON "xp_events"("milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_goal_id_key" ON "xp_events"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_check_in_id_key" ON "xp_events"("check_in_id");

-- CreateIndex
CREATE INDEX "xp_events_user_id_day_idx" ON "xp_events"("user_id", "day");

-- CreateIndex
CREATE INDEX "xp_events_user_id_source_day_idx" ON "xp_events"("user_id", "source", "day");

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_habit_completion_id_fkey" FOREIGN KEY ("habit_completion_id") REFERENCES "habit_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "goal_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "daily_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chaque ligne pointe vers exactement une action, celle de sa source ; jamais d'XP nulle
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_source_check" CHECK (
  num_nonnulls("habit_completion_id", "task_id", "milestone_id", "goal_id", "check_in_id") = 1
  AND ("source" <> 'habit_day' OR "habit_completion_id" IS NOT NULL)
  AND ("source" <> 'task' OR "task_id" IS NOT NULL)
  AND ("source" <> 'milestone' OR "milestone_id" IS NOT NULL)
  AND ("source" <> 'goal' OR "goal_id" IS NOT NULL)
  AND ("source" <> 'check_in' OR "check_in_id" IS NOT NULL)
);
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_amount_check" CHECK ("amount" > 0);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "xp_events" ENABLE ROW LEVEL SECURITY;

-- Rattrapage : l'activité déjà faite rapporte son XP, avec les règles de src/features/xp/rules.ts

-- Habitudes : 10 XP un jour prévu, 5 XP un jour non prévu
INSERT INTO "xp_events" ("id", "user_id", "source", "amount", "pillar", "day", "habit_completion_id")
SELECT gen_random_uuid(), h."user_id", 'habit_day',
       CASE WHEN extract(isodow FROM c."day")::int = ANY (h."weekdays") THEN 10 ELSE 5 END,
       h."pillar", c."day", c."id"
FROM "habit_completions" c
JOIN "habits" h ON h."id" = c."habit_id";

-- Tâches terminées : 10 XP, au plus 10 par jour (dans le fuseau de l'utilisateur)
INSERT INTO "xp_events" ("id", "user_id", "source", "amount", "pillar", "day", "task_id")
SELECT gen_random_uuid(), done."user_id", 'task', 10, g."pillar", done."day", done."id"
FROM (
  SELECT t."id", t."user_id", t."goal_id", d."day",
         row_number() OVER (PARTITION BY t."user_id", d."day" ORDER BY t."completed_at") AS "rank"
  FROM "tasks" t
  LEFT JOIN "user_settings" s ON s."user_id" = t."user_id"
  CROSS JOIN LATERAL (
    SELECT (t."completed_at" AT TIME ZONE COALESCE(s."time_zone", 'America/Toronto'))::date AS "day"
  ) d
  WHERE t."completed_at" IS NOT NULL
) done
LEFT JOIN "goals" g ON g."id" = done."goal_id"
WHERE done."rank" <= 10;

-- Jalons atteints : 25 XP
INSERT INTO "xp_events" ("id", "user_id", "source", "amount", "pillar", "day", "milestone_id")
SELECT gen_random_uuid(), g."user_id", 'milestone', 25, g."pillar",
       (m."completed_at" AT TIME ZONE COALESCE(s."time_zone", 'America/Toronto'))::date, m."id"
FROM "goal_milestones" m
JOIN "goals" g ON g."id" = m."goal_id"
LEFT JOIN "user_settings" s ON s."user_id" = g."user_id"
WHERE m."completed_at" IS NOT NULL;

-- Objectifs atteints (même archivés ensuite : l'archivage garde la date d'atteinte) : 100 XP
INSERT INTO "xp_events" ("id", "user_id", "source", "amount", "pillar", "day", "goal_id")
SELECT gen_random_uuid(), g."user_id", 'goal', 100, g."pillar",
       (g."completed_at" AT TIME ZONE COALESCE(s."time_zone", 'America/Toronto'))::date, g."id"
FROM "goals" g
LEFT JOIN "user_settings" s ON s."user_id" = g."user_id"
WHERE g."completed_at" IS NOT NULL AND g."status" <> 'active';

-- Check-ins : 5 XP
INSERT INTO "xp_events" ("id", "user_id", "source", "amount", "pillar", "day", "check_in_id")
SELECT gen_random_uuid(), c."user_id", 'check_in', 5, NULL, c."day", c."id"
FROM "daily_check_ins" c;
