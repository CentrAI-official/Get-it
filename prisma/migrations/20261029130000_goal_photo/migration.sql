-- Photo choisie pour un objectif, à la place de l'icône de son pilier
ALTER TABLE "goals" ADD COLUMN "photo_path" TEXT;

ALTER TABLE "goals" ADD CONSTRAINT "goals_photo_path_check" CHECK (
  "photo_path" IS NULL OR char_length("photo_path") BETWEEN 1 AND 300
);
