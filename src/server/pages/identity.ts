import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  IDENTITY_COOKIE,
  IDENTITY_COOKIE_MAX_AGE,
  identityFromCookie,
  isIdentity,
  type Identity,
} from "@/config/identity";
import { db } from "@/server/db";

// Le compte actif (mode page) : le cookie dit seulement ce que la personne a
// choisi ; la page est toujours retrouvée par la session (sa propriétaire).

export type ActingPage = {
  id: string;
  handle: string;
  name: string;
  logoPath: string | null;
};

/** Le compte demandé par le cookie de l'appareil. */
async function requestedIdentity(): Promise<Identity> {
  const store = await cookies();
  return identityFromCookie(store.get(IDENTITY_COOKIE)?.value);
}

/**
 * La page au nom de laquelle la personne agit : la sienne, si elle a choisi sa
 * page et qu'elle en a toujours une ; sinon null (son compte personnel).
 */
export const getActingPage = cache(
  async (userId: string): Promise<ActingPage | null> => {
    if ((await requestedIdentity()) !== "page") return null;
    return db.page.findUnique({
      where: { ownerId: userId },
      select: { id: true, handle: true, name: true, logoPath: true },
    });
  },
);

/** Le cookie demande une page qui n'existe plus (supprimée sur un autre appareil). */
export async function isStaleIdentity(userId: string) {
  return (
    (await requestedIdentity()) === "page" &&
    (await getActingPage(userId)) === null
  );
}

/**
 * Pour une action au nom du compte actif : la page (ou null pour le compte
 * personnel). `expected` est le compte sous lequel l'écran a été chargé ; s'il
 * diffère (changé dans un autre onglet), l'action est refusée.
 */
export async function actingFor(
  userId: string,
  expected: unknown,
): Promise<
  { ok: true; pageId: string | null } | { ok: false; error: "identityChanged" }
> {
  const page = await getActingPage(userId);
  const actual: Identity = page ? "page" : "personal";
  if (isIdentity(expected) && expected !== actual) {
    return { ok: false, error: "identityChanged" };
  }
  return { ok: true, pageId: page?.id ?? null };
}

/**
 * Change de compte sur cet appareil. La page doit exister et être à la
 * personne ; sinon on reste sur le compte personnel.
 */
export async function setIdentity(userId: string, identity: Identity) {
  const store = await cookies();
  if (identity === "page") {
    const page = await db.page.count({ where: { ownerId: userId } });
    if (page === 0) return false;
    store.set(IDENTITY_COOKIE, "page", {
      path: "/",
      maxAge: IDENTITY_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // Lu par le script d'avant l'affichage : il ne donne aucun droit
      httpOnly: false,
    });
    return true;
  }
  store.delete(IDENTITY_COOKIE);
  return true;
}
