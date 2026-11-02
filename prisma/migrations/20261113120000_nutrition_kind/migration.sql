-- Plan de nutrition (décision du fondateur, 2026-11-01) : Physique a deux plans,
-- entraînement et nutrition. Valeur d'enum seule dans sa migration : Postgres
-- refuse d'utiliser une valeur ajoutée dans la même transaction.
ALTER TYPE "DevelopmentKind" ADD VALUE IF NOT EXISTS 'nutrition';
