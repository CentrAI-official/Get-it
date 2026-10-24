-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "journal_entry_id" UUID;

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "gratitude" TEXT,
    "win" TEXT,
    "lesson" TEXT,
    "intention" TEXT,
    "body" TEXT,
    "words" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_user_id_day_key" ON "journal_entries"("user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_journal_entry_id_key" ON "xp_events"("journal_entry_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Limites de src/features/journal/rules.ts ; une réponse vide est enregistrée
-- comme null, et une page sans aucun texte est supprimée (jamais vide)
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_text_check" CHECK (
  ("gratitude" IS NULL OR char_length("gratitude") BETWEEN 1 AND 500)
  AND ("win" IS NULL OR char_length("win") BETWEEN 1 AND 500)
  AND ("lesson" IS NULL OR char_length("lesson") BETWEEN 1 AND 500)
  AND ("intention" IS NULL OR char_length("intention") BETWEEN 1 AND 500)
  AND ("body" IS NULL OR char_length("body") BETWEEN 1 AND 5000)
  AND num_nonnulls("gratitude", "win", "lesson", "intention", "body") >= 1
);
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_words_check" CHECK ("words" >= 0);

-- Chaque ligne d'XP pointe vers exactement une action, celle de sa source
ALTER TABLE "xp_events" DROP CONSTRAINT "xp_events_source_check";
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_source_check" CHECK (
  num_nonnulls("habit_completion_id", "task_id", "milestone_id", "goal_id", "check_in_id", "journal_entry_id") = 1
  AND ("source" <> 'habit_day' OR "habit_completion_id" IS NOT NULL)
  AND ("source" <> 'task' OR "task_id" IS NOT NULL)
  AND ("source" <> 'milestone' OR "milestone_id" IS NOT NULL)
  AND ("source" <> 'goal' OR "goal_id" IS NOT NULL)
  AND ("source" <> 'check_in' OR "check_in_id" IS NOT NULL)
  AND ("source" <> 'journal' OR "journal_entry_id" IS NOT NULL)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
