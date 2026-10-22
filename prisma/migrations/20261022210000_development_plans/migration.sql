-- CreateEnum
CREATE TYPE "DevelopmentKind" AS ENUM ('physical', 'mental', 'social', 'financial', 'business');

-- AlterEnum
ALTER TYPE "AiRequestKind" ADD VALUE 'development_plan';

-- CreateTable
CREATE TABLE "development_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "DevelopmentKind" NOT NULL,
    "answers" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "development_plans_user_id_kind_key" ON "development_plans"("user_id", "kind");

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Réponses et plan : des objets JSON de taille raisonnable
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_json_check" CHECK (
  jsonb_typeof("answers") = 'object'
  AND jsonb_typeof("plan") = 'object'
  AND pg_column_size("answers") <= 32000
  AND pg_column_size("plan") <= 200000
);

-- RLS sans policy : la clé publique Supabase n'expose rien
ALTER TABLE "development_plans" ENABLE ROW LEVEL SECURITY;
