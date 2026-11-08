-- Pages pro, lot 4 (décision du fondateur, 2026-11-07) : le pro modifie un
-- plan que son client lui montre ; le client reçoit une notification et doit
-- accepter pour que la modification s'applique. Chaque proposition est gardée
-- (historique) : en attente, acceptée, refusée, retirée, ou dépassée (le plan
-- a changé entre-temps).

CREATE TYPE "PlanProposalStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn', 'outdated');

CREATE TABLE "plan_proposals" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "kind" "DevelopmentKind" NOT NULL,
    -- La semaine type au moment de la proposition, puis celle proposée
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    -- Le mot du pro : pourquoi ce changement
    "note" TEXT NOT NULL DEFAULT '',
    "status" "PlanProposalStatus" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_proposals_pkey" PRIMARY KEY ("id")
);
-- Une seule proposition en attente par page et par plan (une nouvelle remplace l'ancienne)
CREATE UNIQUE INDEX "plan_proposals_pending_key" ON "plan_proposals"("page_id", "plan_id") WHERE "status" = 'pending';
CREATE INDEX "plan_proposals_client_id_status_idx" ON "plan_proposals"("client_id", "status");
CREATE INDEX "plan_proposals_page_id_client_id_created_at_idx" ON "plan_proposals"("page_id", "client_id", "created_at");
CREATE INDEX "plan_proposals_plan_id_idx" ON "plan_proposals"("plan_id");
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur, src/features/clients/proposals.ts)
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_check" CHECK (
  char_length("note") <= 500
  AND "kind" <> 'business'
  AND jsonb_typeof("before") = 'array'
  AND jsonb_typeof("after") = 'array'
  AND jsonb_array_length("after") <= 7
  -- Décidée : on sait quand ; en attente : pas encore
  AND (("status" = 'pending') = ("decided_at" IS NULL))
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "plan_proposals" ENABLE ROW LEVEL SECURITY;
