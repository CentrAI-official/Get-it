-- Catalogue Get iT de Mon développement (décision du fondateur, 2026-11-01) :
-- exercices, recettes et outils ajoutés par l'équipe. Listes alignées sur
-- src/features/library/rules.ts (un test le vérifie).
CREATE TABLE "library_items" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "title_en" TEXT,
    "content" JSONB NOT NULL,
    "tags" TEXT[],
    "minutes" SMALLINT,
    "servings" SMALLINT,
    "video_path" TEXT,
    "image_path" TEXT,
    "seed_key" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "library_items_kind_check" CHECK ("kind" IN ('exercise', 'recipe', 'tool')),
    CONSTRAINT "library_items_status_check" CHECK ("status" IN ('draft', 'published')),
    -- Exercices et recettes : physique ; outils : mental ou social
    CONSTRAINT "library_items_pillar_check" CHECK (
        ("kind" IN ('exercise', 'recipe') AND "pillar" = 'physical')
        OR ("kind" = 'tool' AND "pillar" IN ('mental', 'social'))
    ),
    CONSTRAINT "library_items_title_check" CHECK (char_length("title") BETWEEN 2 AND 120),
    CONSTRAINT "library_items_minutes_check" CHECK ("minutes" IS NULL OR "minutes" BETWEEN 1 AND 600),
    CONSTRAINT "library_items_servings_check" CHECK ("servings" IS NULL OR "servings" BETWEEN 1 AND 24)
);
CREATE UNIQUE INDEX "library_items_seed_key_key" ON "library_items"("seed_key");
CREATE INDEX "library_items_kind_pillar_status_idx" ON "library_items"("kind", "pillar", "status");
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La clé publique de Supabase ne lit rien : tout passe par le serveur
ALTER TABLE "library_items" ENABLE ROW LEVEL SECURITY;
