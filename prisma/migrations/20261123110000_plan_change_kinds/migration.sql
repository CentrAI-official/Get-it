-- Notifications des modifications de plan proposées par une page pro (lot 4).
-- Valeurs d'enum à part (voir 20261025120000_journal_xp_source).
ALTER TYPE "NotificationKind" ADD VALUE 'plan_change';
ALTER TYPE "NotificationKind" ADD VALUE 'plan_change_accepted';
ALTER TYPE "NotificationKind" ADD VALUE 'plan_change_declined';
