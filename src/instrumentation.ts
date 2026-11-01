import type { Instrumentation } from "next";

/**
 * Erreurs serveur (pages, Server Actions, routes, proxy) inscrites pour le
 * dashboard de l'équipe, sans données personnelles. Node seulement : la base
 * n'est pas joignable depuis l'Edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordServerError } = await import("./server/errors/service");
  await recordServerError(error, context.routePath);
};
