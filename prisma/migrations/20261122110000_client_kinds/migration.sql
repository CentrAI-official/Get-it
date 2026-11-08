-- Notifications du suivi des clients d'une page pro (lot 3). Valeurs d'enum à
-- part (voir 20261025120000_journal_xp_source).
ALTER TYPE "NotificationKind" ADD VALUE 'client_invite';
ALTER TYPE "NotificationKind" ADD VALUE 'client_request';
ALTER TYPE "NotificationKind" ADD VALUE 'client_accepted';
