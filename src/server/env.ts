import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: "doit être une URL PostgreSQL (postgresql://…)",
  }),
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: "doit être l'URL du projet Supabase (https://…supabase.co)",
  }),
  // Les variables NEXT_PUBLIC_ sont envoyées au navigateur : la clé secrète
  // (sb_secret_…) contourne le RLS et ne doit jamais s'y trouver.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", {
      error:
        "doit être la clé publiable (sb_publishable_…), jamais la clé secrète",
    }),
  // Clé secrète Supabase (sb_secret_…) : serveur seulement, pour le stockage des
  // photos et vidéos. Facultative : sans elle, l'ajout de médias est désactivé.
  SUPABASE_SECRET_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .startsWith("sb_secret_", {
        error: "doit être une clé secrète Supabase (sb_secret_…)",
      })
      .optional(),
  ),
  // Clé de l'API Claude (console.anthropic.com) : serveur seulement. Facultative :
  // sans elle, Get iT AI s'affiche comme « pas encore activé ».
  ANTHROPIC_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .startsWith("sk-ant-", {
        error: "doit être une clé de l'API Anthropic (sk-ant-…)",
      })
      .optional(),
  ),
  // Bêta privée : code à donner aux testeurs pour créer un compte. Serveur
  // seulement. Facultatif : sans lui, l'inscription est ouverte.
  SIGNUP_INVITE_CODE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .min(4, { error: "doit contenir au moins 4 caractères" })
      .max(64, { error: "doit contenir au plus 64 caractères" })
      .optional(),
  ),
  // « fake » : réponses factices pour les tests de bout en bout, sans appel payant
  AI_PROVIDER: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["claude", "fake"]).optional(),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valide les variables serveur ; lève une erreur lisible si l'une d'elles est invalide. */
export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  // Une clé secrète ne doit jamais être exposée au navigateur
  const leaked = Object.entries(env).find(
    ([name, value]) =>
      name.startsWith("NEXT_PUBLIC_") &&
      (value?.startsWith("sk-ant-") || value?.startsWith("sb_secret_")),
  );
  if (leaked) {
    throw new Error(
      `Variables d'environnement invalides : ${leaked[0]} contient une clé secrète. Les variables NEXT_PUBLIC_ sont envoyées au navigateur ; utilise ANTHROPIC_API_KEY ou SUPABASE_SECRET_KEY.`,
    );
  }
  const result = serverEnvSchema.safeParse(env);
  if (result.success && result.data.AI_PROVIDER === "fake") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "Variables d'environnement invalides : AI_PROVIDER=fake est réservé aux tests, jamais en production.",
      );
    }
  }
  if (!result.success) {
    throw new Error(
      `Variables d'environnement invalides (voir .env.example) :\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

let cachedEnv: ServerEnv | undefined;

/** Variables d'environnement serveur, validées au premier accès. */
export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
