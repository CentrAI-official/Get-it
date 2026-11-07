-- Un vrai logiciel de budget (décision du fondateur, 2026-11-04) : le plan par
-- catégorie, les paiements fixes qui deviennent de vraies transactions, les
-- comptes et les virements, les objectifs d'épargne. Données privées (Loi 25) :
-- jamais montrées aux autres membres ni envoyées à Get iT AI. Montants en cents.

-- Comptes : chèques, épargne, comptant, placements, biens, carte de crédit, prêt.
-- Le solde d'ouverture est signé : une dette est négative.
CREATE TABLE "budget_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "opening_cents" INTEGER NOT NULL,
    "opened_on" DATE NOT NULL,
    "rate_bp" INTEGER,
    "minimum_cents" INTEGER,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "budget_accounts_user_id_idx" ON "budget_accounts"("user_id");
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Objectifs d'épargne : ce qui est mis de côté vient des transactions liées.
CREATE TABLE "budget_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_cents" INTEGER NOT NULL,
    "target_on" DATE,
    "starting_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_goals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "budget_goals_user_id_idx" ON "budget_goals"("user_id");
ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catégories : une ligne pour une catégorie personnelle (`key` est son uuid, avec
-- `name`, `group` et `icon`) ou pour le report d'une catégorie de Get iT.
CREATE TABLE "budget_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "group" TEXT,
    "icon" TEXT,
    "rollover_from" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_categories_user_id_key_key" ON "budget_categories"("user_id", "key");
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Le plan : un montant vaut à partir de `month` (son 1er jour), jusqu'au prochain
-- changement. Pas besoin de refaire son budget chaque mois.
CREATE TABLE "budget_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_plans_user_id_category_month_key" ON "budget_plans"("user_id", "category", "month");
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un montant fixe : son compte (et celui d'arrivée pour un virement), et jusqu'où
-- il a déjà été inscrit dans les transactions.
ALTER TABLE "budget_recurring" ADD COLUMN "account_id" UUID;
ALTER TABLE "budget_recurring" ADD COLUMN "to_account_id" UUID;
ALTER TABLE "budget_recurring" ADD COLUMN "posted_through" DATE;
ALTER TABLE "budget_recurring" ADD CONSTRAINT "budget_recurring_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "budget_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_recurring" ADD CONSTRAINT "budget_recurring_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "budget_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Une transaction : ses comptes, le montant fixe dont elle vient, son objectif, et
-- l'empreinte d'une ligne importée (importer deux fois le même fichier n'ajoute rien).
ALTER TABLE "budget_entries" ADD COLUMN "account_id" UUID;
ALTER TABLE "budget_entries" ADD COLUMN "to_account_id" UUID;
ALTER TABLE "budget_entries" ADD COLUMN "recurring_id" UUID;
ALTER TABLE "budget_entries" ADD COLUMN "recurring_on" DATE;
ALTER TABLE "budget_entries" ADD COLUMN "goal_id" UUID;
ALTER TABLE "budget_entries" ADD COLUMN "import_key" TEXT;
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "budget_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "budget_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "budget_recurring"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "budget_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "budget_entries_recurring_id_recurring_on_key" ON "budget_entries"("recurring_id", "recurring_on");
CREATE UNIQUE INDEX "budget_entries_user_id_import_key_key" ON "budget_entries"("user_id", "import_key");
CREATE INDEX "budget_entries_account_id_idx" ON "budget_entries"("account_id");
CREATE INDEX "budget_entries_to_account_id_idx" ON "budget_entries"("to_account_id");
CREATE INDEX "budget_entries_goal_id_idx" ON "budget_entries"("goal_id");

-- Mêmes listes et limites que src/features/budget/ (un test le vérifie). Une
-- catégorie est une de Get iT, ou l'uuid d'une catégorie personnelle.
ALTER TABLE "budget_recurring" DROP CONSTRAINT "budget_recurring_check";
ALTER TABLE "budget_recurring" ADD CONSTRAINT "budget_recurring_check" CHECK (
  "kind" IN ('income', 'expense', 'transfer')
  AND char_length("label") BETWEEN 1 AND 60
  AND "amount_cents" BETWEEN 1 AND 100000000
  AND "frequency" IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')
  AND (
    ("kind" IN ('income', 'transfer') AND "category" IS NULL)
    OR ("kind" = 'expense' AND "category" IS NOT NULL AND ("category" IN ('housing', 'utilities', 'phone', 'groceries', 'transport', 'insurance', 'health', 'children', 'fees', 'taxes', 'restaurants', 'leisure', 'subscriptions', 'shopping', 'personal', 'travel', 'gifts', 'pets', 'education', 'other', 'savings', 'debt') OR "category" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
  )
  AND ("ends_on" IS NULL OR "ends_on" >= "starts_on")
);

ALTER TABLE "budget_entries" DROP CONSTRAINT "budget_entries_check";
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_check" CHECK (
  "kind" IN ('income', 'expense', 'refund', 'transfer', 'adjustment')
  AND ("note" IS NULL OR char_length("note") BETWEEN 1 AND 80)
  AND ("import_key" IS NULL OR char_length("import_key") = 64)
  AND (
    ("kind" = 'adjustment' AND "amount_cents" <> 0 AND "amount_cents" BETWEEN -2000000000 AND 2000000000)
    OR ("kind" <> 'adjustment' AND "amount_cents" BETWEEN 1 AND 100000000)
  )
  AND (
    ("kind" IN ('income', 'transfer', 'adjustment') AND "category" IS NULL)
    OR ("kind" IN ('expense', 'refund') AND "category" IS NOT NULL AND ("category" IN ('housing', 'utilities', 'phone', 'groceries', 'transport', 'insurance', 'health', 'children', 'fees', 'taxes', 'restaurants', 'leisure', 'subscriptions', 'shopping', 'personal', 'travel', 'gifts', 'pets', 'education', 'other', 'savings', 'debt') OR "category" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
  )
);

ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_check" CHECK (
  char_length("name") BETWEEN 1 AND 40
  AND "type" IN ('chequing', 'savings', 'cash', 'investment', 'property', 'credit', 'loan')
  AND "opening_cents" BETWEEN -2000000000 AND 2000000000
  AND ("rate_bp" IS NULL OR "rate_bp" BETWEEN 0 AND 10000)
  AND ("minimum_cents" IS NULL OR "minimum_cents" BETWEEN 0 AND 100000000)
);

ALTER TABLE "budget_goals" ADD CONSTRAINT "budget_goals_check" CHECK (
  char_length("name") BETWEEN 1 AND 40
  AND "target_cents" BETWEEN 1 AND 100000000
  AND "starting_cents" BETWEEN 0 AND 100000000
);

ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_check" CHECK (
  ("name" IS NULL OR char_length("name") BETWEEN 1 AND 30)
  AND ("group" IS NULL OR "group" IN ('needs', 'wants', 'savings'))
  AND ("name" IS NULL) = ("group" IS NULL)
);

ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_check" CHECK (
  "amount_cents" BETWEEN 0 AND 100000000
  AND EXTRACT(DAY FROM "month") = 1
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "budget_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_plans" ENABLE ROW LEVEL SECURITY;
