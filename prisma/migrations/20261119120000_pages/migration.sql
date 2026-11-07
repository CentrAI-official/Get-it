-- Pages pro (décision du fondateur, 2026-11-07) : comme une page Facebook, une
-- personne qui vend des services a sa page, séparée de son compte personnel.
-- Une page par personne pour commencer. Les annonces de la Marketplace sont
-- rattachées à la page.

CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "logo_path" TEXT,
    "cover_path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pages_owner_id_key" ON "pages"("owner_id");
CREATE UNIQUE INDEX "pages_handle_key" ON "pages"("handle");

ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mêmes listes et limites que src/features/pages/rules.ts (un test le vérifie)
ALTER TABLE "pages" ADD CONSTRAINT "pages_check" CHECK (
  char_length("name") BETWEEN 1 AND 60
  AND "handle" ~ '^[a-z0-9]([a-z0-9._-]{1,28})[a-z0-9]$'
  AND "category" IN ('fitness_coach', 'nutritionist', 'financial_advisor', 'psychologist', 'other')
  AND char_length("about") <= 600
  AND ("website" IS NULL OR char_length("website") BETWEEN 1 AND 200)
  AND "regions" <@ ARRAY['online', 'bas_saint_laurent', 'saguenay_lac_saint_jean', 'capitale_nationale', 'mauricie', 'estrie', 'montreal', 'outaouais', 'abitibi_temiscamingue', 'cote_nord', 'nord_du_quebec', 'gaspesie_iles_de_la_madeleine', 'chaudiere_appalaches', 'laval', 'lanaudiere', 'laurentides', 'monteregie', 'centre_du_quebec']::TEXT[]
);

-- Une annonce appartient à une page ; la page supprimée emporte ses annonces
ALTER TABLE "listings" ADD COLUMN "page_id" UUID;
ALTER TABLE "listings" ADD CONSTRAINT "listings_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "listings_page_id_idx" ON "listings"("page_id");

-- Les affiliés d'aujourd'hui ont déjà leur page (décision du fondateur) : son
-- nom est celui du compte, son adresse le nom d'utilisateur quand il convient,
-- son domaine celui de leur annonce la plus fréquente. La photo n'est pas
-- reprise : le fichier appartient au profil.
INSERT INTO "pages" ("id", "owner_id", "handle", "name", "category", "regions", "updated_at")
SELECT
  gen_random_uuid(),
  p."id",
  CASE
    WHEN p."username" ~ '^[a-z0-9]([a-z0-9._-]{1,28})[a-z0-9]$' THEN p."username"
    ELSE 'page-' || left(replace(p."id"::text, '-', ''), 12)
  END,
  left(COALESCE(NULLIF(trim(p."display_name"), ''), p."username", 'Ma page'), 60),
  COALESCE(
    (
      SELECT l."category" FROM "listings" l
      WHERE l."seller_id" = p."id"
        AND l."kind" = 'service'
        AND l."category" IN ('fitness_coach', 'nutritionist', 'financial_advisor', 'psychologist', 'other')
      GROUP BY l."category"
      ORDER BY count(*) DESC, l."category"
      LIMIT 1
    ),
    'other'
  ),
  COALESCE(
    (
      SELECT array_agg(DISTINCT region ORDER BY region)
      FROM "listings" l, unnest(l."regions") AS region
      WHERE l."seller_id" = p."id"
    ),
    ARRAY[]::TEXT[]
  ),
  CURRENT_TIMESTAMP
FROM "profiles" p
WHERE p."account_type" = 'affiliate';

UPDATE "listings" l
SET "page_id" = g."id"
FROM "pages" g
WHERE g."owner_id" = l."seller_id";

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;
