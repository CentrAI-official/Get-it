-- Rappel d'un paiement fixe, la veille (dans sa propre migration : une valeur
-- d'enum ne sert qu'après la transaction qui l'ajoute)
ALTER TYPE "NotificationKind" ADD VALUE 'bill_due';
