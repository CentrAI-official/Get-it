"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { saveJournalAction } from "../actions";
import { journalFont } from "../font";
import { JOURNAL_BODY_MAX_LENGTH, countWords } from "../rules";

/** Délai sans frappe avant l'enregistrement automatique. */
const AUTOSAVE_DELAY = 1200;
/** Le compteur de caractères n'apparaît qu'à l'approche de la limite. */
const SHOW_COUNT_FROM = JOURNAL_BODY_MAX_LENGTH - 1000;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; xp: number }
  | { kind: "cleared" }
  | { kind: "error"; error: "locked" | "invalid" | "unexpected" };

/**
 * Page du journal d'un jour encore modifiable : une page de carnet qui
 * s'enregistre toute seule pendant qu'on écrit. Montée avec `key={day}`.
 */
export function JournalEditor({
  day,
  body,
}: {
  day: string;
  body: string | null;
}) {
  const t = useTranslations("Journal.editor");
  const tPage = useTranslations("Journal.page");
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(body ?? "");
  const [savedText, setSavedText] = useState(body ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Un enregistrement à la fois ; une frappe pendant l'envoi en relance un
  const saving = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  const dirty = text !== savedText;

  async function save() {
    if (saving.current) return;
    const value = latest.current;
    saving.current = true;
    setStatus({ kind: "saving" });
    const result = await saveJournalAction({ day, body: value });
    saving.current = false;
    if (!result.ok) {
      setStatus({ kind: "error", error: result.error });
      return;
    }
    setSavedText(value);
    setStatus(
      result.saved ? { kind: "saved", xp: result.xp } : { kind: "cleared" },
    );
    // Écrit pendant l'envoi : on enregistre la suite
    if (latest.current !== value) void save();
  }

  // Enregistrement automatique après une pause dans l'écriture
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
    // `save` lit la dernière valeur par référence
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, dirty]);

  // La page grandit avec le texte, comme un carnet
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  const words = countWords(text);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-page`} className="flex flex-col gap-0.5">
        <span className="font-heading font-semibold">{tPage("label")}</span>
        <span className="text-sm text-muted-foreground">{tPage("hint")}</span>
      </label>

      {/* La marge du carnet s'allume quand on écrit */}
      <div className="group relative pl-6">
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-2 w-px bg-white/12 transition-colors group-focus-within:bg-primary/70"
        />
        <textarea
          ref={area}
          id={`${id}-page`}
          value={text}
          maxLength={JOURNAL_BODY_MAX_LENGTH}
          placeholder={tPage("placeholder")}
          spellCheck
          onChange={(event) => {
            setText(event.target.value);
            setStatus({ kind: "idle" });
          }}
          onBlur={() => {
            if (latest.current !== savedText) void save();
          }}
          className={cn(
            journalFont.className,
            "block min-h-[60vh] w-full resize-none overflow-hidden bg-transparent journal-lines pt-[0.2rem] text-[1.125rem] text-foreground/95 outline-none placeholder:text-muted-foreground/60 placeholder:italic",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pl-6 text-sm">
        <p role="status" className="flex min-h-5 items-center gap-1.5">
          {status.kind === "saving" ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              {t("saving")}
            </span>
          ) : status.kind === "saved" ? (
            <span className="flex items-center gap-1.5 text-primary">
              <Check aria-hidden="true" className="size-4" />
              {status.xp > 0 ? t("savedXp", { xp: status.xp }) : t("saved")}
            </span>
          ) : status.kind === "cleared" ? (
            <span className="text-muted-foreground">{t("cleared")}</span>
          ) : status.kind === "error" ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <CircleAlert aria-hidden="true" className="size-4" />
              {t(`errors.${status.error}`)}
            </span>
          ) : dirty ? (
            <span className="text-muted-foreground">{t("unsaved")}</span>
          ) : null}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {text.length >= SHOW_COUNT_FROM
            ? tPage("characters", {
                count: text.length,
                max: JOURNAL_BODY_MAX_LENGTH,
              })
            : tPage("words", { count: words })}
        </p>
      </div>
    </div>
  );
}
