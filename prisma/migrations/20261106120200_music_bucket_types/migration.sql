-- Musique des stories : le compartiment privé « media » accepte aussi les fichiers
-- audio du catalogue (mêmes types que MUSIC_TYPES dans src/features/stories/music.ts).
-- Les envois restent autorisés chemin par chemin par le serveur, puis revérifiés.
UPDATE storage.buckets
SET "allowed_mime_types" = ARRAY(
  SELECT DISTINCT unnest(
    "allowed_mime_types" || ARRAY['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav']
  )
)
WHERE "id" = 'media';
