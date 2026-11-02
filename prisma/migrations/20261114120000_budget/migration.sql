-- Financier › Budget (décision du fondateur, 2026-11-01) : revenus et dépenses
-- fixes avec leur fréquence, et mouvements au jour le jour. Données privées
-- (Loi 25) : jamais montrées aux autres membres ni envoyées à Get iT AI.
-- Montants en cents, dans la devise du pays du compte.

CREATE TABLE "budget_recurring" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_recurring_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_recurring_user_id_idx" ON "budget_recurring"("user_id");

ALTER TABLE "budget_recurring" ADD CONSTRAINT "budget_recurring_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "budget_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "occurred_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_entries_user_id_occurred_on_idx" ON "budget_entries"("user_id", "occurred_on");
CREATE INDEX "budget_entries_user_id_created_at_idx" ON "budget_entries"("user_id", "created_at");

ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mêmes listes et limites que src/features/budget/rules.ts (un test le vérifie)
ALTER TABLE "budget_recurring" ADD CONSTRAINT "budget_recurring_check" CHECK (
  "kind" IN ('income', 'expense')
  AND char_length("label") BETWEEN 1 AND 60
  AND "amount_cents" BETWEEN 1 AND 100000000
  AND "frequency" IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')
  AND (
    ("kind" = 'income' AND "category" IS NULL)
    OR ("kind" = 'expense' AND "category" IS NOT NULL AND "category" IN ('housing', 'groceries', 'transport', 'restaurants', 'leisure', 'subscriptions', 'health', 'debt', 'savings', 'other'))
  )
  AND ("ends_on" IS NULL OR "ends_on" >= "starts_on")
);

ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_check" CHECK (
  "kind" IN ('income', 'expense')
  AND "amount_cents" BETWEEN 1 AND 100000000
  AND ("note" IS NULL OR char_length("note") BETWEEN 1 AND 80)
  AND (
    ("kind" = 'income' AND "category" IS NULL)
    OR ("kind" = 'expense' AND "category" IS NOT NULL AND "category" IN ('housing', 'groceries', 'transport', 'restaurants', 'leisure', 'subscriptions', 'health', 'debt', 'savings', 'other'))
  )
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "budget_recurring" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_entries" ENABLE ROW LEVEL SECURITY;
