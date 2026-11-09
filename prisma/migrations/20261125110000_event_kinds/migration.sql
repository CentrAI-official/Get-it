-- Notifications des Événements de la Communauté (dans leur propre migration :
-- une nouvelle valeur d'enum ne sert qu'après la transaction qui l'ajoute)
ALTER TYPE "NotificationKind" ADD VALUE 'event_rsvp';
ALTER TYPE "NotificationKind" ADD VALUE 'event_update';
ALTER TYPE "NotificationKind" ADD VALUE 'event_cancelled';
