"use client";

import { useLocale } from "next-intl";
import { useEffect, useTransition, type ReactNode } from "react";
import type { Identity } from "@/config/identity";
import { switchIdentityAction } from "../actions";
import { reloadTo } from "../client";

/** Où l'on arrive en changeant de compte, comme sur Facebook : son profil. */
export const IDENTITY_HOME = { page: "/pro", personal: "/profile" } as const;

/**
 * Passe à sa page ou revient à son compte. L'application est rechargée en
 * entier : aucun écran déjà chargé ne reste sous l'autre compte.
 */
export function IdentitySwitch({
  to,
  href,
  className,
  children,
}: {
  to: Identity;
  /** Où arriver (sans la langue) ; par défaut, le profil du compte choisi. */
  href?: `/${string}`;
  className?: string;
  children: ReactNode;
}) {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchIdentityAction(to).catch(() => null);
          if (result?.ok) {
            reloadTo(locale, href ?? IDENTITY_HOME[to]);
          }
        })
      }
      className={className}
    >
      {children}
    </button>
  );
}

/**
 * La page choisie n'existe plus (supprimée sur un autre appareil) : retour au
 * compte personnel, une seule fois.
 */
export function ClearStaleIdentity() {
  useEffect(() => {
    void switchIdentityAction("personal").then(() => window.location.reload());
  }, []);
  return null;
}
