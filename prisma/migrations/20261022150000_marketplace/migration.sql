-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('consumer', 'affiliate');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('service', 'gear');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('pending', 'approved', 'rejected', 'archived');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "account_type" "AccountType" NOT NULL DEFAULT 'consumer';

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'pending',
    "pillar" "Pillar" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_min_cents" INTEGER NOT NULL,
    "price_max_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "price_unit" TEXT NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "website" TEXT,
    "social_url" TEXT,
    "license_number" TEXT,
    "media_count" SMALLINT NOT NULL DEFAULT 0,
    "review_note" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_media" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_status_kind_pillar_created_at_idx" ON "listings"("status", "kind", "pillar", "created_at");

-- CreateIndex
CREATE INDEX "listings_seller_id_created_at_idx" ON "listings"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_media_listing_id_position_idx" ON "listing_media"("listing_id", "position");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes : listes alignées sur src/features/marketplace/rules.ts
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_check" CHECK (
  ("kind" = 'service' AND "category" IN ('fitness_coach', 'nutritionist', 'financial_advisor', 'psychologist', 'other'))
  OR ("kind" = 'gear' AND "category" IN ('clothing', 'equipment', 'books', 'other'))
);

-- Prix en cents (100 000 $ au plus), fourchette réservée aux services
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_check" CHECK (
  "price_min_cents" BETWEEN 0 AND 10000000
  AND ("price_max_cents" IS NULL OR ("kind" = 'service' AND "price_max_cents" BETWEEN "price_min_cents" AND 10000000))
  AND "currency" = 'CAD'
  AND (("kind" = 'service' AND "price_unit" IN ('session', 'hour', 'month', 'package'))
    OR ("kind" = 'gear' AND "price_unit" = 'item'))
);

-- Régions : au moins une pour un service, aucune pour le gear
ALTER TABLE "listings" ADD CONSTRAINT "listings_regions_check" CHECK (
  "regions" IS NOT NULL
  AND "regions" <@ ARRAY['online', 'bas_saint_laurent', 'saguenay_lac_saint_jean', 'capitale_nationale',
    'mauricie', 'estrie', 'montreal', 'outaouais', 'abitibi_temiscamingue', 'cote_nord', 'nord_du_quebec',
    'gaspesie_iles_de_la_madeleine', 'chaudiere_appalaches', 'laval', 'lanaudiere', 'laurentides',
    'monteregie', 'centre_du_quebec']::TEXT[]
  AND (("kind" = 'service' AND cardinality("regions") >= 1) OR ("kind" = 'gear' AND cardinality("regions") = 0))
);

-- Longueurs (les minimums détaillés sont vérifiés par le serveur)
ALTER TABLE "listings" ADD CONSTRAINT "listings_text_check" CHECK (
  char_length("title") BETWEEN 1 AND 80
  AND char_length("summary") BETWEEN 1 AND 160
  AND char_length("description") BETWEEN 1 AND 3000
  AND char_length("contact_name") BETWEEN 1 AND 100
  AND char_length("contact_email") BETWEEN 3 AND 254
  AND ("website" IS NULL OR char_length("website") <= 300)
  AND ("social_url" IS NULL OR char_length("social_url") <= 300)
  AND ("license_number" IS NULL OR char_length("license_number") <= 50)
  AND ("review_note" IS NULL OR char_length("review_note") <= 500)
);

ALTER TABLE "listings" ADD CONSTRAINT "listings_media_count_check" CHECK ("media_count" BETWEEN 0 AND 4);

-- Une annonce approuvée ou refusée a été examinée par l'équipe
ALTER TABLE "listings" ADD CONSTRAINT "listings_review_check" CHECK (
  "status" NOT IN ('approved', 'rejected') OR "reviewed_at" IS NOT NULL
);

ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_shape_check" CHECK (
  "width" > 0 AND "height" > 0 AND "size_bytes" > 0 AND "position" BETWEEN 0 AND 3
);

-- RLS sans policy : la clé publique Supabase n'expose rien
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listing_media" ENABLE ROW LEVEL SECURITY;
