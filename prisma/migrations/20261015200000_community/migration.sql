-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('text', 'question', 'progress');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('visible', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'harassment', 'hate', 'self_harm', 'inappropriate', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "suspended_until" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "community_rules_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "PostKind" NOT NULL,
    "body" TEXT NOT NULL,
    "pillar" "Pillar",
    "progress" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("post_id","user_id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "post_id" UUID,
    "comment_id" UUID,
    "reported_user_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateIndex
CREATE INDEX "posts_status_created_at_idx" ON "posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "posts_user_id_created_at_idx" ON "posts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comments_post_id_created_at_idx" ON "post_comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comments_user_id_created_at_idx" ON "post_comments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "post_reactions_user_id_idx" ON "post_reactions"("user_id");

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporter_id_post_id_key" ON "content_reports"("reporter_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporter_id_comment_id_key" ON "content_reports"("reporter_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporter_id_reported_user_id_key" ON "content_reports"("reporter_id", "reported_user_id");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garanties en base (en plus de la validation du serveur)
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_username_check" CHECK (
  "username" IS NULL OR "username" ~ '^[a-z0-9_]{3,20}$'
);
ALTER TABLE "posts" ADD CONSTRAINT "posts_body_check" CHECK (
  char_length("body") <= 1000
  AND ("kind" = 'progress' OR char_length(btrim("body")) > 0)
  AND (("kind" = 'progress') = ("progress" IS NOT NULL))
);
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_body_check" CHECK (
  char_length(btrim("body")) BETWEEN 1 AND 500
);
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_target_check" CHECK (
  num_nonnulls("post_id", "comment_id", "reported_user_id") = 1
  AND ("details" IS NULL OR char_length("details") <= 500)
);
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_self_check" CHECK ("blocker_id" <> "blocked_id");

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_blocks" ENABLE ROW LEVEL SECURITY;
