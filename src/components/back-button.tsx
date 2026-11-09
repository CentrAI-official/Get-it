"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { canGoBack } from "@/lib/nav-history";

/**
 * « Retour » d'une page qu'on ouvre de partout (Notifications, Get iT AI) :
 * revient à la page d'avant, ou à `fallback` si on est arrivé directement
 * (notification du téléphone, lien partagé).
 */
export function BackButton({
  fallback,
  label,
}: {
  fallback: `/${string}`;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack()) router.back();
        else router.push(fallback, { transitionTypes: ["nav-back"] });
      }}
      className="flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
