-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "title" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "weekdays" INTEGER[],
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_completions" (
    "id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habits_user_id_archived_at_idx" ON "habits"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "habits_goal_id_idx" ON "habits"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "habit_completions_habit_id_day_key" ON "habit_completions"("habit_id", "day");

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jours prévus : au moins un, chacun de 1 (lundi) à 7 (dimanche), garanti aussi par la base
ALTER TABLE "habits" ADD CONSTRAINT "habits_weekdays_check" CHECK (cardinality("weekdays") BETWEEN 1 AND 7 AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "habits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habit_completions" ENABLE ROW LEVEL SECURITY;
