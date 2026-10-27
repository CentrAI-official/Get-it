-- Groupes du Centre Get iT : publics (forum : publications et commentaires) ou
-- privés (discussion de groupe dans la Messagerie, sur invitation). Un pilier,
-- ou aucun (groupe général).
CREATE TYPE "GroupVisibility" AS ENUM ('public', 'private');
CREATE TYPE "GroupRole" AS ENUM ('owner', 'admin', 'member');
-- « invited » : invitation à un groupe privé, pas encore acceptée
CREATE TYPE "GroupMemberStatus" AS ENUM ('active', 'invited');

CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pillar" "Pillar",
    "visibility" "GroupVisibility" NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "groups_visibility_created_at_idx" ON "groups"("visibility", "created_at");
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- Le groupe disparaît avec le compte de son créateur
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "groups" ADD CONSTRAINT "groups_text_check" CHECK (
  char_length(btrim("name")) BETWEEN 3 AND 60
  AND char_length("description") <= 500
);

CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'member',
    "status" "GroupMemberStatus" NOT NULL DEFAULT 'active',
    "invited_by_id" UUID,
    "joined_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id")
);

CREATE INDEX "group_members_user_id_status_idx" ON "group_members"("user_id", "status");
CREATE INDEX "group_members_invited_by_id_idx" ON "group_members"("invited_by_id");
-- Un seul créateur par groupe
CREATE UNIQUE INDEX "group_members_one_owner" ON "group_members"("group_id") WHERE "role" = 'owner';

ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Une invitation n'a pas de rôle de gestion ; un membre actif a sa date d'arrivée
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_state_check" CHECK (
  ("status" = 'active') = ("joined_at" IS NOT NULL)
  AND ("status" = 'active' OR "role" = 'member')
);

-- Forum : publications d'un groupe public (absentes du fil du Centre)
ALTER TABLE "posts" ADD COLUMN "group_id" UUID;
ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "posts_group_id_created_at_idx" ON "posts"("group_id", "created_at");

-- Discussion : la conversation d'un groupe privé (sans clé de paire)
ALTER TABLE "conversations" ADD COLUMN "group_id" UUID;
ALTER TABLE "conversations" ALTER COLUMN "direct_key" DROP NOT NULL;
CREATE UNIQUE INDEX "conversations_group_id_key" ON "conversations"("group_id");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_kind_check" CHECK (
  ("group_id" IS NULL) <> ("direct_key" IS NULL)
);

-- Sécurité : RLS sans policy, comme toutes les tables (voir 20261007200000_init)
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
