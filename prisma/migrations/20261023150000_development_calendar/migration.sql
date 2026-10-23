-- AlterTable : période des plans existants, puis colonnes obligatoires
ALTER TABLE "development_plans" ADD COLUMN "ends_on" DATE,
ADD COLUMN "starts_on" DATE;

-- Début : le jour où le plan a été (re)fait ; fin : la date visée du
-- questionnaire si elle suit, sinon celle de l'objectif proposé, sinon 12 semaines
UPDATE "development_plans" SET "starts_on" = ("updated_at" AT TIME ZONE 'America/Toronto')::date;
UPDATE "development_plans" SET "ends_on" = CASE
  WHEN ("answers"->>'targetDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("answers"->>'targetDate')::date > "starts_on"
    THEN LEAST(("answers"->>'targetDate')::date, "starts_on" + 1825)
  WHEN jsonb_typeof("plan"->'goal') = 'object'
    THEN "starts_on" + LEAST(GREATEST(COALESCE(("plan"->'goal'->>'targetInDays')::int, 84), 7), 1825)
  ELSE "starts_on" + 84
END;

ALTER TABLE "development_plans" ALTER COLUMN "starts_on" SET NOT NULL,
ALTER COLUMN "ends_on" SET NOT NULL;

ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_period_check" CHECK (
  "ends_on" > "starts_on" AND "ends_on" <= "starts_on" + 1830
);

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "development_plan_id" UUID;

-- AlterTable
ALTER TABLE "habits" ADD COLUMN     "development_plan_id" UUID;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "development_plan_id" UUID;

-- CreateIndex
CREATE INDEX "goals_development_plan_id_idx" ON "goals"("development_plan_id");

-- CreateIndex
CREATE INDEX "habits_development_plan_id_idx" ON "habits"("development_plan_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_due_date_idx" ON "tasks"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "tasks_development_plan_id_idx" ON "tasks"("development_plan_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_development_plan_id_fkey" FOREIGN KEY ("development_plan_id") REFERENCES "development_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_development_plan_id_fkey" FOREIGN KEY ("development_plan_id") REFERENCES "development_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_development_plan_id_fkey" FOREIGN KEY ("development_plan_id") REFERENCES "development_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
