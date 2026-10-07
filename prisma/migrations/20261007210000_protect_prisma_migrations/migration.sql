-- Sécurité : Prisma crée sa table interne _prisma_migrations dans le schéma public.
-- Supabase l'expose alors via son API, avec tous les droits pour les rôles anon et
-- authenticated (clé publique). RLS sans policy + retrait des droits ; Prisma, propriétaire
-- de la table, n'est pas concerné. Gardé conditionnel pour la base fantôme de `migrate dev`.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON public._prisma_migrations FROM anon, authenticated;
    END IF;
  END IF;
END $$;
