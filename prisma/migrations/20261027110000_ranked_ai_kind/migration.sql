-- Nouvelle sorte de demande à Get iT AI : l'analyse d'un niveau Ranked. Seule
-- dans sa migration : une valeur d'enum ajoutée ne peut pas servir dans la
-- même transaction.
ALTER TYPE "AiRequestKind" ADD VALUE 'ranked_analysis';
