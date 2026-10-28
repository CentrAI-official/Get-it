"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setFavoriteAction } from "../actions";

type FavoriteButtonProps = {
  listingId: string;
  /** Titre de l'annonce, pour le nom du bouton. */
  title: string;
  initial: boolean;
  /** Posé sur une photo : fond sombre pour rester lisible. */
  overlay?: boolean;
  className?: string;
};

/** Cœur d'une annonce : « Mes favoris », privé. */
export function FavoriteButton({
  listingId,
  title,
  initial,
  overlay = false,
  className,
}: FavoriteButtonProps) {
  const t = useTranslations("Marketplace.favorites");
  const [on, setOn] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setNotice(null);
    startTransition(async () => {
      const result = await setFavoriteAction(listingId, next);
      if (result.ok) return;
      setOn(!next);
      setNotice(t(result.error === "favoritesLimit" ? "limit" : "failed"));
    });
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={t(on ? "remove" : "add", { title })}
        onClick={toggle}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          overlay
            ? "bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          className,
        )}
      >
        <Heart
          aria-hidden="true"
          className={cn(
            "size-5 transition-transform motion-safe:active:scale-125",
            on && "fill-primary text-primary",
          )}
        />
      </button>
      <span role="status" className="sr-only">
        {notice}
      </span>
    </>
  );
}
