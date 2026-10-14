-- CreateEnum
CREATE TYPE "AiRequestKind" AS ENUM ('coach', 'goal_plan');

-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('user', 'assistant');

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "ai_consent_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "AiRequestKind" NOT NULL,
    "day" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coach_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "CoachRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_requests_user_id_day_idx" ON "ai_requests"("user_id", "day");

-- CreateIndex
CREATE INDEX "coach_conversations_user_id_updated_at_idx" ON "coach_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "coach_messages_conversation_id_created_at_idx" ON "coach_messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "coach_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jetons jamais négatifs ; un message de l'utilisateur fait au plus 2 000 caractères
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_tokens_check" CHECK (
  "input_tokens" >= 0 AND "output_tokens" >= 0 AND "cache_read_tokens" >= 0 AND "cache_write_tokens" >= 0
);
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_length_check" CHECK (
  "role" <> 'user' OR char_length("content") <= 2000
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "ai_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coach_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coach_messages" ENABLE ROW LEVEL SECURITY;
