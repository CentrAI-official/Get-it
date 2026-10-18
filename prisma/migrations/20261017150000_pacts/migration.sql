-- CreateEnum
CREATE TYPE "PactRule" AS ENUM ('daily', 'most');

-- CreateEnum
CREATE TYPE "PactStatus" AS ENUM ('proposed', 'active', 'declined', 'cancelled', 'ended');

-- CreateEnum
CREATE TYPE "PactOutcome" AS ENUM ('success', 'failed');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'pact';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "pact_id" UUID;

-- CreateTable
CREATE TABLE "pacts" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "days" INTEGER NOT NULL,
    "rule" "PactRule" NOT NULL DEFAULT 'most',
    "status" "PactStatus" NOT NULL DEFAULT 'proposed',
    "starts_on" DATE,
    "ends_on" DATE,
    "outcome" "PactOutcome",
    "ended_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pact_members" (
    "pact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "habit_id" UUID,
    "joined_at" TIMESTAMPTZ(3),

    CONSTRAINT "pact_members_pkey" PRIMARY KEY ("pact_id","user_id")
);

-- CreateIndex
CREATE INDEX "pacts_conversation_id_status_idx" ON "pacts"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "pacts_proposed_by_id_created_at_idx" ON "pacts"("proposed_by_id", "created_at");

-- CreateIndex
CREATE INDEX "pact_members_user_id_idx" ON "pact_members"("user_id");

-- CreateIndex
CREATE INDEX "pact_members_habit_id_idx" ON "pact_members"("habit_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_pact_id_fkey" FOREIGN KEY ("pact_id") REFERENCES "pacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pact_members" ADD CONSTRAINT "pact_members_pact_id_fkey" FOREIGN KEY ("pact_id") REFERENCES "pacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pact_members" ADD CONSTRAINT "pact_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pact_members" ADD CONSTRAINT "pact_members_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur)
ALTER TABLE "pacts" ADD CONSTRAINT "pacts_shape_check" CHECK (
  char_length(btrim("title")) BETWEEN 1 AND 60
  AND "days" IN (7, 14, 30)
  AND ("status" NOT IN ('active', 'ended') OR ("starts_on" IS NOT NULL AND "ends_on" IS NOT NULL))
  AND (("status" = 'ended') = ("outcome" IS NOT NULL))
);
-- Un seul pacte ouvert (proposé ou en cours) par conversation
CREATE UNIQUE INDEX "pacts_one_open_per_conversation" ON "pacts" ("conversation_id")
  WHERE "status" IN ('proposed', 'active');
-- Message d'un pacte : une étape connue, sans texte libre ni progrès
-- (kind::text : la nouvelle valeur d'enum n'est pas utilisable avant la fin de la transaction)
ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check";
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (
  char_length("body") <= 2000
  AND (
    "deleted_at" IS NOT NULL
    OR ("kind"::text = 'text' AND char_length(btrim("body")) > 0 AND "progress" IS NULL AND "pact_id" IS NULL)
    OR ("kind"::text = 'progress' AND "progress" IS NOT NULL AND "pact_id" IS NULL)
    OR ("kind"::text = 'pact' AND "pact_id" IS NOT NULL AND "body" IN ('proposed', 'ended', 'cancelled'))
  )
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "pacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pact_members" ENABLE ROW LEVEL SECURITY;
