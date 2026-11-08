-- Pages pro, lot 3 (décisions du fondateur, 2026-11-07) : les clients d'une
-- page. Le pro invite ou le client demande ; le client accepte toujours et
-- choisit ce que la page voit, plan par plan (le plan mental seulement avec un
-- accord explicite). Plusieurs pros par client, chacun ne voit que ce qui lui
-- est partagé. Les notes du pro restent après la fin du suivi.

CREATE TYPE "PageClientStatus" AS ENUM ('invited', 'requested', 'active', 'ended');

CREATE TABLE "page_clients" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "PageClientStatus" NOT NULL,
    -- Qui a commencé : la page (invitation) ou le client (demande)
    "initiated_by" TEXT NOT NULL,
    -- Plans que le client montre à la page, choisis par lui seul
    "shared_kinds" "DevelopmentKind"[] NOT NULL DEFAULT '{}',
    -- Accord explicite pour le plan mental (renseignements sensibles, Loi 25)
    "mental_consent_at" TIMESTAMPTZ(3),
    -- Mot joint à l'invitation ou à la demande
    "message" TEXT NOT NULL DEFAULT '',
    "accepted_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "page_clients_pkey" PRIMARY KEY ("id")
);
-- Un seul suivi ouvert (invitation, demande ou en cours) par page et par personne
CREATE UNIQUE INDEX "page_clients_open_key" ON "page_clients"("page_id", "client_id") WHERE "status" <> 'ended';
CREATE INDEX "page_clients_page_id_status_idx" ON "page_clients"("page_id", "status");
CREATE INDEX "page_clients_client_id_idx" ON "page_clients"("client_id");
ALTER TABLE "page_clients" ADD CONSTRAINT "page_clients_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_clients" ADD CONSTRAINT "page_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur, src/features/clients/rules.ts)
ALTER TABLE "page_clients" ADD CONSTRAINT "page_clients_check" CHECK (
  "initiated_by" IN ('page', 'client')
  AND char_length("message") <= 300
  -- Les plans visibles (le plan d'entreprise est retiré)
  AND "shared_kinds" <@ ARRAY['physical', 'nutrition', 'mental', 'social', 'financial']::"DevelopmentKind"[]
  -- Le plan mental seulement avec un accord explicite
  AND (NOT ('mental' = ANY ("shared_kinds")) OR "mental_consent_at" IS NOT NULL)
  -- Une invitation : le client n'a encore rien choisi
  AND ("status" <> 'invited' OR ("shared_kinds" = '{}' AND "mental_consent_at" IS NULL))
  AND ("status" <> 'active' OR "accepted_at" IS NOT NULL)
  -- Fini : la page ne voit plus rien
  AND ("status" <> 'ended' OR ("ended_at" IS NOT NULL AND "shared_kinds" = '{}' AND "mental_consent_at" IS NULL))
);

-- Notes du pro sur un client : privées, jamais montrées au client ; elles
-- restent après la fin du suivi et partent avec la page ou le compte du client
CREATE TABLE "client_notes" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_notes_page_id_client_id_created_at_idx" ON "client_notes"("page_id", "client_id", "created_at");
CREATE INDEX "client_notes_client_id_idx" ON "client_notes"("client_id");
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_body_check" CHECK (
  char_length(btrim("body")) > 0 AND char_length("body") <= 2000
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "page_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_notes" ENABLE ROW LEVEL SECURITY;
