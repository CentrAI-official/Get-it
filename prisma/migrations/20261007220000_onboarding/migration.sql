-- CreateEnum
CREATE TYPE "Pillar" AS ENUM ('physical', 'mental', 'social', 'financial');

-- CreateEnum
CREATE TYPE "Occupation" AS ENUM ('student', 'employee', 'self_employed', 'entrepreneur', 'job_seeker', 'other');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'archived');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "focus_pillars" "Pillar"[] DEFAULT ARRAY[]::"Pillar"[],
ADD COLUMN     "occupation" "Occupation",
ADD COLUMN     "onboarded_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "daily_minutes" INTEGER;

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pillar_assessments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "score" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pillar_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "pillar_assessments_user_id_pillar_created_at_idx" ON "pillar_assessments"("user_id", "pillar", "created_at");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pillar_assessments" ADD CONSTRAINT "pillar_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Score d'autoévaluation : de 1 à 5, garanti aussi par la base
ALTER TABLE "pillar_assessments" ADD CONSTRAINT "pillar_assessments_score_check" CHECK ("score" BETWEEN 1 AND 5);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pillar_assessments" ENABLE ROW LEVEL SECURITY;
