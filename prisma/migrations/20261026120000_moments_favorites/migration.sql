-- Moment de la journée (calendrier « Semaine » de Mon développement)
-- CreateEnum
CREATE TYPE "DayMoment" AS ENUM ('morning', 'noon', 'evening');

-- AlterTable
ALTER TABLE "habits" ADD COLUMN "moment" "DayMoment";

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "moment" "DayMoment";

-- Favoris de la Marketplace (privés, effacés avec le compte ou l'annonce)
-- CreateTable
CREATE TABLE "listing_favorites" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateIndex
CREATE INDEX "listing_favorites_listing_id_idx" ON "listing_favorites"("listing_id");

-- CreateIndex
CREATE INDEX "listing_favorites_user_id_created_at_idx" ON "listing_favorites"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "listing_favorites" ENABLE ROW LEVEL SECURITY;
