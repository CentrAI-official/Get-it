-- Renseignements personnels demandés à la création du compte : date de
-- naissance, sexe à la naissance, pays, province ou État, région du Québec.
-- Privés (jamais montrés aux autres) ; vides pour les comptes créés avant :
-- ils sont demandés une fois à la prochaine ouverture.
CREATE TYPE "Sex" AS ENUM ('male', 'female');
CREATE TYPE "Country" AS ENUM ('CA', 'US');

ALTER TABLE "profiles"
  ADD COLUMN "birth_date" DATE,
  ADD COLUMN "sex" "Sex",
  ADD COLUMN "country" "Country",
  ADD COLUMN "province" TEXT,
  ADD COLUMN "qc_region" TEXT;

-- Mêmes listes que src/features/profile/details.ts (un test le vérifie)
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_details_check" CHECK (
  ("birth_date" IS NULL OR "birth_date" >= DATE '1900-01-01')
  AND ("province" IS NULL OR "country" IS NOT NULL)
  AND (
    "province" IS NULL
    OR ("country" = 'CA' AND "province" IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'))
    OR ("country" = 'US' AND "province" IN ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'))
  )
  AND ("qc_region" IS NULL OR "province" = 'QC')
  AND ("qc_region" IS NULL OR "qc_region" IN ('bas_saint_laurent', 'saguenay_lac_saint_jean', 'capitale_nationale', 'mauricie', 'estrie', 'montreal', 'outaouais', 'abitibi_temiscamingue', 'cote_nord', 'nord_du_quebec', 'gaspesie_iles_de_la_madeleine', 'chaudiere_appalaches', 'laval', 'lanaudiere', 'laurentides', 'monteregie', 'centre_du_quebec'))
);
