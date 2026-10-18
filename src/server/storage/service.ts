import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SIGNED_URL_SECONDS } from "@/features/community/media";
import { getServerEnv } from "@/server/env";

// Stockage des photos et vidéos (compartiment privé « media » de Supabase
// Storage). Seul ce fichier utilise la clé secrète : le navigateur n'envoie un
// fichier qu'avec une autorisation à usage unique, et ne lit qu'avec des liens
// temporaires, tous deux créés ici.

const BUCKET = "media";

let client: ReturnType<typeof createClient> | undefined;

function bucket() {
  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY) return null;
  client ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client.storage.from(BUCKET);
}

/** Vrai si le stockage est configuré (clé secrète présente). */
export function storageEnabled() {
  return Boolean(getServerEnv().SUPABASE_SECRET_KEY);
}

/** Autorisation d'envoi à usage unique pour ce chemin (adresse à appeler en PUT). */
export async function createUploadUrl(path: string) {
  const storage = bucket();
  if (!storage) throw new Error("Stockage non configuré");
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error) throw error;
  return data.signedUrl;
}

/** Taille et type d'un fichier envoyé ; null s'il n'existe pas. */
export async function fileInfo(path: string) {
  const storage = bucket();
  if (!storage) return null;
  const slash = path.lastIndexOf("/");
  const { data, error } = await storage.list(path.slice(0, slash), {
    search: path.slice(slash + 1),
    limit: 1,
  });
  if (error) throw error;
  const file = data.find((item) => item.name === path.slice(slash + 1));
  if (!file?.metadata) return null;
  return {
    size: Number(file.metadata.size ?? 0),
    mimeType: String(file.metadata.mimetype ?? ""),
  };
}

/** Liens de lecture temporaires (une heure), par chemin. */
export async function signedUrls(paths: string[]) {
  const urls = new Map<string, string>();
  const storage = bucket();
  if (!storage || paths.length === 0) return urls;
  const { data, error } = await storage.createSignedUrls(
    paths,
    SIGNED_URL_SECONDS,
  );
  if (error) throw error;
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

/** Supprime des fichiers (sans erreur s'ils n'existent plus). */
export async function removeFiles(paths: string[]) {
  const storage = bucket();
  if (!storage || paths.length === 0) return;
  const { error } = await storage.remove(paths);
  if (error) throw error;
}

/** Supprime tous les fichiers d'un utilisateur (suppression du compte). */
export async function removeUserFiles(userId: string) {
  const storage = bucket();
  if (!storage) return;
  const folder = `posts/${userId}`;
  for (;;) {
    const { data, error } = await storage.list(folder, { limit: 100 });
    if (error) throw error;
    if (data.length === 0) return;
    await removeFiles(data.map((item) => `${folder}/${item.name}`));
    if (data.length < 100) return;
  }
}
