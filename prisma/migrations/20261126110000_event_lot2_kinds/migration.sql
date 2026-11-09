-- Notifications des Événements, lot 2 (dans leur propre migration : une valeur
-- d'enum ne sert qu'après la transaction qui l'ajoute)
ALTER TYPE "NotificationKind" ADD VALUE 'event_comment';
ALTER TYPE "NotificationKind" ADD VALUE 'event_reminder';
