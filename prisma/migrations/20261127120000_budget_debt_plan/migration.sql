-- Budget : le jour du paiement d'une dette, et le fonds d'urgence que suit le
-- plan d'argent (décisions du fondateur, 2026-11-10). Le plan lui-même est
-- calculé par Get iT à chaque visite : rien d'autre n'est enregistré.

-- Le jour du mois où le paiement d'une dette est dû (un 31 tombe le 30 d'un mois court)
ALTER TABLE "budget_accounts" ADD COLUMN "payment_day" SMALLINT;
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_payment_day_check"
  CHECK ("payment_day" IS NULL OR "payment_day" BETWEEN 1 AND 31);

-- Le fonds d'urgence : un seul par personne
ALTER TABLE "budget_goals" ADD COLUMN "kind" TEXT;
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_kind_check"
  CHECK ("kind" IS NULL OR "kind" IN ('emergency'));
CREATE UNIQUE INDEX "budget_goals_emergency_key" ON "budget_goals"("user_id")
  WHERE "kind" = 'emergency';

-- Le fonds d'urgence créé avant : le plus ancien objectif qui porte son nom
UPDATE "budget_goals" AS g
SET "kind" = 'emergency'
FROM (
  SELECT DISTINCT ON ("user_id") "id"
  FROM "budget_goals"
  WHERE "name" IN ('Fonds d’urgence', 'Fonds d''urgence', 'Emergency fund')
  ORDER BY "user_id", "created_at"
) AS first
WHERE g."id" = first."id";
