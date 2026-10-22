-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('pending', 'accepted');

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "addressee_id" UUID NOT NULL,
    "pair_key" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_pair_key_key" ON "contacts"("pair_key");

-- CreateIndex
CREATE INDEX "contacts_addressee_id_status_idx" ON "contacts"("addressee_id", "status");

-- CreateIndex
CREATE INDEX "contacts_requester_id_status_idx" ON "contacts"("requester_id", "status");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur)
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_pair_check" CHECK (
  "requester_id" <> "addressee_id"
  AND "pair_key" ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
