-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "avatar_path" TEXT,
ADD COLUMN     "bio" TEXT;

-- Bio courte et chemin de photo raisonnable
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_bio_check" CHECK (
  "bio" IS NULL OR char_length("bio") BETWEEN 1 AND 160
);
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_path_check" CHECK (
  "avatar_path" IS NULL OR char_length("avatar_path") BETWEEN 1 AND 300
);
