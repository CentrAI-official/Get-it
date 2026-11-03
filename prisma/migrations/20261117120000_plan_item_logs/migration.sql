-- Plans de nutrition, mental, social et financier : cocher un élément du jour
-- (décision du fondateur, 2026-11-03). Une ligne = un élément fait ce jour-là.
-- Une ligne compte dans la série du jour, pour le pilier du plan. Données
-- privées : jamais montrées aux autres membres.
CREATE TABLE "plan_item_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID,
    "kind" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,
    "item" TEXT NOT NULL,
    "replaced_by" TEXT,
    "outcome" SMALLINT,
    "budget_entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_item_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_item_logs_user_id_kind_day_weekday_position_key" ON "plan_item_logs"("user_id", "kind", "day", "weekday", "position");
CREATE INDEX "plan_item_logs_user_id_day_idx" ON "plan_item_logs"("user_id", "day");

ALTER TABLE "plan_item_logs" ADD CONSTRAINT "plan_item_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- L'historique appartient à la personne : il survit à la suppression du plan
ALTER TABLE "plan_item_logs" ADD CONSTRAINT "plan_item_logs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "development_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_item_logs" ADD CONSTRAINT "plan_item_logs_budget_entry_id_fkey" FOREIGN KEY ("budget_entry_id") REFERENCES "budget_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mêmes listes et limites que src/features/plan-logs/rules.ts (un test le vérifie)
ALTER TABLE "plan_item_logs" ADD CONSTRAINT "plan_item_logs_check" CHECK (
  "kind" IN ('nutrition', 'mental', 'social', 'financial')
  AND "weekday" BETWEEN 1 AND 7
  AND "position" BETWEEN 0 AND 9
  AND char_length("item") BETWEEN 1 AND 200
  AND ("replaced_by" IS NULL OR char_length("replaced_by") BETWEEN 1 AND 120)
  AND ("outcome" IS NULL OR "outcome" BETWEEN 1 AND 3)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "plan_item_logs" ENABLE ROW LEVEL SECURITY;
