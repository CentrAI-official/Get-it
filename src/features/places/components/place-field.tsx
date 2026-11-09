"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { searchPlacesAction } from "../actions";
import { PLACE_QUERY, type PlaceSuggestion } from "../rules";

/** Délai après la dernière lettre avant de chercher. */
const DEBOUNCE_MS = 300;

/**
 * Champ « Lieu » qui propose des adresses pendant qu'on tape (Photon, d'après
 * OpenStreetMap, par notre serveur). On peut aussi garder son propre texte
 * (« Chez Marie », « Au gym »). Au clavier : flèches, Entrée, Échap.
 */
export function PlaceField({
  id,
  name,
  value,
  onChange,
  maxLength,
  placeholder,
  invalid = false,
  describedBy,
  inputClassName,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  inputClassName?: string;
}) {
  const t = useTranslations("Places");
  const locale = useLocale();
  const listId = useId();
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  // Seule la réponse à la dernière lettre tapée compte
  const request = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function type(text: string) {
    onChange(text);
    setActive(-1);
    if (timer.current !== null) window.clearTimeout(timer.current);
    const query = text.trim();
    if (query.length < PLACE_QUERY.min) {
      request.current += 1;
      setPlaces([]);
      setLoading(false);
      return;
    }
    setOpen(true);
    timer.current = window.setTimeout(() => {
      const mine = (request.current += 1);
      setLoading(true);
      void searchPlacesAction(query, locale, maxLength)
        .catch(() => [])
        .then((found) => {
          if (mine !== request.current) return;
          setPlaces(found);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
  }

  function choose(place: PlaceSuggestion) {
    request.current += 1;
    onChange(place.label);
    setPlaces([]);
    setOpen(false);
    setActive(-1);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || places.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % places.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? places.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      const place = places[active];
      if (place) choose(place);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const shown = open && (places.length > 0 || loading);

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        name={name}
        value={value}
        onChange={(event) => type(event.target.value)}
        onKeyDown={keys}
        onFocus={() => places.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          shown && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className={inputClassName}
      />
      {shown ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {loading && places.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {t("searching")}
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={t("label")}>
            {places.map((place, index) => (
              <li
                key={place.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // Avant que le champ perde le focus : le choix compte
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 border-b border-foreground/8 px-4 py-3 last:border-b-0",
                  index === active
                    ? "bg-foreground/8"
                    : "hover:bg-foreground/5",
                )}
              >
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {place.primary}
                  </span>
                  {place.secondary ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {place.secondary}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {places.length > 0 ? (
            <p className="px-4 py-2 text-[11px] text-muted-foreground">
              {t("attribution")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
