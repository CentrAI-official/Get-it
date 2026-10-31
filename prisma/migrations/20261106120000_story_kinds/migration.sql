-- Valeurs d'enum à part : Postgres refuse d'utiliser une valeur ajoutée dans la
-- même transaction (voir 20261025120000_journal_xp_source).

-- Réponse à une story dans la Messagerie
ALTER TYPE "MessageKind" ADD VALUE 'story';

-- Réponse à la question d'une story
ALTER TYPE "NotificationKind" ADD VALUE 'story';
