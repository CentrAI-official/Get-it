import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: "doit être une URL PostgreSQL (postgresql://…)",
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
