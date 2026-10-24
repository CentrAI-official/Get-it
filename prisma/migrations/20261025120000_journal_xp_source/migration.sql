-- Nouvelle source d'XP : une page du journal. Seule dans sa migration : une
-- valeur d'enum ajoutée ne peut pas servir dans la même transaction.
ALTER TYPE "XpSource" ADD VALUE 'journal';
