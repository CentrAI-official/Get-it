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
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valide les variables serveur ; lève une erreur lisible si l'une d'elles est invalide. */
export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
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
