-- CreateEnum
CREATE TYPE "CoachActionKind" AS ENUM ('goal', 'habit', 'task', 'milestone');

-- CreateEnum
CREATE TYPE "CoachActionStatus" AS ENUM ('pending', 'applied', 'dismissed');

-- CreateTable
CREATE TABLE "coach_actions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "CoachActionKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "CoachActionStatus" NOT NULL DEFAULT 'pending',
    "created_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_actions_message_id_idx" ON "coach_actions"("message_id");

-- CreateIndex
CREATE INDEX "coach_actions_user_id_status_idx" ON "coach_actions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "coach_actions" ADD CONSTRAINT "coach_actions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "coach_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_actions" ADD CONSTRAINT "coach_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "coach_actions" ENABLE ROW LEVEL SECURITY;
