-- Thème de l'interface choisi dans Réglages : suit l'utilisateur sur tous ses
-- appareils. « system » : clair ou sombre selon le réglage de l'appareil.
CREATE TYPE "ThemePreference" AS ENUM ('system', 'light', 'dark');

ALTER TABLE "user_settings" ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'system';
