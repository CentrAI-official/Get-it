-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "ranked_public_pillars" "Pillar"[] DEFAULT ARRAY['physical', 'social']::"Pillar"[];

-- CreateTable
CREATE TABLE "ranked_evaluations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "physical" SMALLINT NOT NULL,
    "mental" SMALLINT NOT NULL,
    "social" SMALLINT NOT NULL,
    "financial" SMALLINT NOT NULL,
    "total" SMALLINT NOT NULL,
    "analysis" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranked_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ranked_evaluations_user_id_created_at_idx" ON "ranked_evaluations"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ranked_evaluations" ADD CONSTRAINT "ranked_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Niveaux de 1 à 100 (src/features/ranked/scoring.ts)
ALTER TABLE "ranked_evaluations" ADD CONSTRAINT "ranked_evaluations_levels_check" CHECK (
  "physical" BETWEEN 1 AND 100
  AND "mental" BETWEEN 1 AND 100
  AND "social" BETWEEN 1 AND 100
  AND "financial" BETWEEN 1 AND 100
  AND "total" BETWEEN 1 AND 100
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "ranked_evaluations" ENABLE ROW LEVEL SECURITY;
