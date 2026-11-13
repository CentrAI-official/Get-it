"use client";

import { Clock, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveTimeZoneAction } from "../actions";
import { cityOf, sameClock, timeZoneOptions } from "../time-zones";

/** Le fuseau du téléphone, ou null (navigateur sans Intl ou valeur inconnue). */
function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => undefined;

/** Le fuseau du téléphone, connu seulement une fois la page affichée (null au serveur). */
function useDeviceTimeZone() {
  return useSyncExternalStore(noSubscribe, deviceTimeZone, () => null);
}

/**
 * « Vancouver · heure du Pacifique ». Le nom du fuseau vient des données Intl du
 * navigateur, différentes de celles du serveur : seulement la ville au premier
 * affichage, pour que la page s'hydrate sans écart.
 */
function useZoneLabel() {
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  return (timeZone: string) => {
    if (!hydrated) return cityOf(timeZone);
    let name = "";
    try {
      name =
        new Intl.DateTimeFormat(locale, {
          timeZone,
          timeZoneName: "longGeneric",
        })
          .formatToParts(new Date())
          .find((part) => part.type === "timeZoneName")?.value ?? "";
    } catch {
      name = "";
    }
    return name ? `${cityOf(timeZone)} · ${name}` : cityOf(timeZone);
  };
}

/** Réglages › Fuseau horaire : la liste, et celui du téléphone proposé en premier s'il diffère. */
export function TimeZoneSelect({ current }: { current: string }) {
  const t = useTranslations("App.settings.timeZone");
  const id = useId();
  const label = useZoneLabel();
  const device = useDeviceTimeZone();
  const [value, setValue] = useState(current);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    setValue(next);
    setError(false);
    startTransition(async () => {
      const ok = await saveTimeZoneAction(next).catch(() => false);
      if (!ok) {
        setError(true);
        setValue(current);
      }
    });
  }

  const differs = device !== null && !sameClock(device, value, new Date());

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-zone`} className="text-sm font-semibold">
        {t("label")}
      </label>
      <div className="flex items-center gap-2">
        <select
          id={`${id}-zone`}
          value={value}
          disabled={pending}
          onChange={(event) => save(event.target.value)}
          className="h-11 w-full max-w-sm rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {timeZoneOptions(current, device).map((zone) => (
            <option key={zone} value={zone}>
              {label(zone)}
            </option>
          ))}
        </select>
        {pending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>
      {differs && device ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            {t("device", { zone: label(device) })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            disabled={pending}
            onClick={() => save(device)}
          >
            {t("useDevice")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}

const DISMISS_KEY = "getit-time-zone-kept";

/** « Garder » choisi sur cet appareil : « compte>téléphone », ou null. */
function readKept() {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * Le téléphone n'est plus à l'heure du compte (voyage, déménagement) : une carte
 * propose de passer à la nouvelle heure. « Garder » vaut pour ce fuseau-là, sur
 * cet appareil.
 */
export function TimeZonePrompt({ current }: { current: string }) {
  const t = useTranslations("App.settings.timeZone.prompt");
  const device = useDeviceTimeZone();
  const kept = useSyncExternalStore(noSubscribe, readKept, () => null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (
    closed ||
    !device ||
    sameClock(device, current, new Date()) ||
    kept === `${current}>${device}`
  ) {
    return null;
  }

  function keep() {
    try {
      localStorage.setItem(DISMISS_KEY, `${current}>${device}`);
    } catch {
      // Stockage bloqué : la carte reviendra à la prochaine visite
    }
    setClosed(true);
  }

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 flex justify-center px-4 lg:bottom-6"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-foreground/10 bg-popover p-4 text-popover-foreground shadow-lg">
        <p className="flex items-start gap-2.5">
          <Clock
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-primary"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{t("title")}</span>
            <span className="text-sm text-pretty text-muted-foreground">
              {t("description", {
                device: cityOf(device),
                account: cityOf(current),
              })}
            </span>
          </span>
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            disabled={pending}
            onClick={keep}
          >
            {t("keep", { city: cityOf(current) })}
          </Button>
          <Button
            type="button"
            className="h-10"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(false);
                const ok = await saveTimeZoneAction(device).catch(() => false);
                if (ok) setClosed(true);
                else setError(true);
              })
            }
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("switch", { city: cityOf(device) })}
          </Button>
        </div>
      </div>
    </div>
  );
}
