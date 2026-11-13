-- « Ajouter à mon calendrier » : la copie privée suit l'événement de la
-- Communauté (date, heure, lieu) et part avec lui s'il est supprimé.
ALTER TABLE "calendar_events" ADD COLUMN "community_event_id" UUID;
ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_community_event_id_fkey"
  FOREIGN KEY ("community_event_id") REFERENCES "community_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "calendar_events_community_event_id_idx" ON "calendar_events"("community_event_id");

-- Conditions d'utilisation et politique de confidentialité acceptées (Loi 25)
ALTER TABLE "user_settings" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(3);
