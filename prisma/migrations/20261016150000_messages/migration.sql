-- CreateEnum
CREATE TYPE "ConversationMemberStatus" AS ENUM ('accepted', 'request');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('text', 'progress');

-- CreateEnum
CREATE TYPE "MessageReactionKind" AS ENUM ('bravo', 'force', 'proud', 'thanks');

-- AlterTable
ALTER TABLE "content_reports" ADD COLUMN     "message_id" UUID;

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "direct_key" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "ConversationMemberStatus" NOT NULL DEFAULT 'accepted',
    "last_read_at" TIMESTAMPTZ(3),
    "cleared_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL DEFAULT '',
    "progress" JSONB,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "MessageReactionKind" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");

-- CreateIndex
CREATE INDEX "conversations_created_by_id_created_at_idx" ON "conversations"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporter_id_message_id_key" ON "content_reports"("reporter_id", "message_id");

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur)
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_key_check" CHECK (
  "direct_key" ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'
);
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (
  char_length("body") <= 2000
  AND (
    "deleted_at" IS NOT NULL
    OR ("kind" = 'text' AND char_length(btrim("body")) > 0 AND "progress" IS NULL)
    OR ("kind" = 'progress' AND "progress" IS NOT NULL)
  )
);
ALTER TABLE "content_reports" DROP CONSTRAINT "content_reports_target_check";
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_check" CHECK (
  num_nonnulls("post_id", "comment_id", "reported_user_id", "message_id") = 1
  AND ("details" IS NULL OR char_length("details") <= 500)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_reactions" ENABLE ROW LEVEL SECURITY;
