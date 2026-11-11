-- Les paiements fixes ne s'inscrivent plus tout seuls (décision du fondateur,
-- 2026-11-10) : une dépense ou un virement fixe se coche quand il est payé, une
-- paie se confirme au montant reçu. Payé, c'est une transaction
-- (budget_entries.recurring_id et recurring_on) ; ce qui n'a pas eu lieu
-- (« Pas ce mois-ci », une paie pas reçue) est gardé ici. Données privées
-- (Loi 25), effacées avec le compte ou le montant fixe.
CREATE TABLE "budget_skips" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recurring_id" UUID NOT NULL,
    "occurred_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_skips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_skips_recurring_id_occurred_on_key" ON "budget_skips"("recurring_id", "occurred_on");
CREATE INDEX "budget_skips_user_id_occurred_on_idx" ON "budget_skips"("user_id", "occurred_on");
ALTER TABLE "budget_skips" ADD CONSTRAINT "budget_skips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_skips" ADD CONSTRAINT "budget_skips_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "budget_recurring"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "budget_skips" ENABLE ROW LEVEL SECURITY;

-- Rappel la veille à 9 h : la date du dernier paiement rappelé (jamais deux fois)
ALTER TABLE "budget_recurring" ADD COLUMN "reminded_on" DATE;

-- Les paiements cochés se retrouvent par leur date prévue
CREATE INDEX "budget_entries_user_id_recurring_on_idx" ON "budget_entries"("user_id", "recurring_on");

-- Rappels des paiements fixes : activés par défaut, à couper dans Factures
ALTER TABLE "user_settings" ADD COLUMN "bill_reminders" BOOLEAN NOT NULL DEFAULT true;
