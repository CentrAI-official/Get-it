-- Le mode Ranked ne classe plus que le physique et le financier, avec de
-- nouvelles questions : les anciennes évaluations (social et mental, autres
-- réponses) ne se relisent plus et sont retirées.
DELETE FROM "ranked_evaluations";

-- Les niveaux Ranked sont tous publics : plus de choix des piliers visibles
ALTER TABLE "profiles" DROP COLUMN "ranked_public_pillars";

ALTER TABLE "ranked_evaluations" DROP CONSTRAINT "ranked_evaluations_levels_check";
ALTER TABLE "ranked_evaluations" DROP COLUMN "mental",
DROP COLUMN "social";

-- Niveaux de 1 à 100 (src/features/ranked/scoring.ts)
ALTER TABLE "ranked_evaluations" ADD CONSTRAINT "ranked_evaluations_levels_check" CHECK (
  "physical" BETWEEN 1 AND 100
  AND "financial" BETWEEN 1 AND 100
  AND "total" BETWEEN 1 AND 100
);
