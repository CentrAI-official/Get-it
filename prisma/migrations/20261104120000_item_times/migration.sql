-- Heure des habitudes et des tâches (minutes depuis minuit, dans le fuseau de
-- la personne). Null : pas d'heure, l'élément reste rangé par son moment.
ALTER TABLE "habits" ADD COLUMN "time_minute" SMALLINT;
ALTER TABLE "habits" ADD CONSTRAINT "habits_time_minute_check" CHECK ("time_minute" IS NULL OR "time_minute" BETWEEN 0 AND 1439);

ALTER TABLE "tasks" ADD COLUMN "time_minute" SMALLINT;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_time_minute_check" CHECK ("time_minute" IS NULL OR "time_minute" BETWEEN 0 AND 1439);
