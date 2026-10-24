"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveJournalAction } from "../actions";
import {
  JOURNAL_BODY_MAX_LENGTH,
  JOURNAL_PROMPTS,
  JOURNAL_PROMPT_MAX_LENGTH,
  type JournalText,
} from "../rules";

type JournalEditorProps = {
  day: string;
  entry: JournalText | null;
};

type Status =
  | { kind: "idle" }
  | { kind: "saved"; xp: number }
  | { kind: "cleared" }
  | { kind: "error"; error: "locked" | "invalid" | "unexpected" };

const toFields = (
  entry: JournalText | null,
): Record<keyof JournalText, string> => ({
  gratitude: entry?.gratitude ?? "",
  win: entry?.win ?? "",
  lesson: entry?.lesson ?? "",
  intention: entry?.intention ?? "",
  body: entry?.body ?? "",
});

/**
 * Page du journal d'un jour encore modifiable : questions guidées et texte
 * libre. Monté avec `key={day}` : changer de jour repart de la page enregistrée.
 */
export function JournalEditor({ day, entry }: JournalEditorProps) {
  const t = useTranslations("Journal.editor");
  const tPrompts = useTranslations("Journal.prompts");
  const id = useId();
  const [fields, setFields] = useState(() => toFields(entry));
  const [saved, setSaved] = useState(() => toFields(entry));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const dirty = (Object.keys(fields) as (keyof JournalText)[]).some(
    (key) => fields[key] !== saved[key],
  );

  function update(key: keyof JournalText, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setStatus({ kind: "idle" });
  }

  function save() {
    startTransition(async () => {
      const result = await saveJournalAction({ day, ...fields });
      if (!result.ok) {
        setStatus({ kind: "error", error: result.error });
        return;
      }
      setSaved(fields);
      setStatus(
        result.saved ? { kind: "saved", xp: result.xp } : { kind: "cleared" },
      );
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {JOURNAL_PROMPTS.map((prompt) => (
        <div key={prompt} className="flex flex-col gap-2">
          <label htmlFor={`${id}-${prompt}`} className="flex flex-col gap-0.5">
            <span className="font-heading font-semibold">
              {tPrompts(`${prompt}.label`)}
            </span>
            <span className="text-sm text-muted-foreground">
              {tPrompts(`${prompt}.hint`)}
            </span>
          </label>
          <Textarea
            id={`${id}-${prompt}`}
            value={fields[prompt]}
            maxLength={JOURNAL_PROMPT_MAX_LENGTH}
            rows={2}
            onChange={(event) => update(prompt, event.target.value)}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2 border-t border-white/8 pt-6">
        <label htmlFor={`${id}-body`} className="flex flex-col gap-0.5">
          <span className="font-heading font-semibold">
            {tPrompts("body.label")}
          </span>
          <span className="text-sm text-muted-foreground">
            {tPrompts("body.hint")}
          </span>
        </label>
        <Textarea
          id={`${id}-body`}
          value={fields.body}
          maxLength={JOURNAL_BODY_MAX_LENGTH}
          rows={8}
          placeholder={tPrompts("body.placeholder")}
          onChange={(event) => update("body", event.target.value)}
        />
        <p className="text-right font-mono text-xs text-muted-foreground">
          {fields.body.length}/{JOURNAL_BODY_MAX_LENGTH}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {t("save")}
        </Button>
        <p role="status" className="text-sm">
          {status.kind === "saved" ? (
            <span className="flex items-center gap-1.5 text-primary">
              <Check aria-hidden="true" className="size-4" />
              {status.xp > 0 ? t("savedXp", { xp: status.xp }) : t("saved")}
            </span>
          ) : status.kind === "cleared" ? (
            <span className="text-muted-foreground">{t("cleared")}</span>
          ) : dirty ? (
            <span className="text-muted-foreground">{t("unsaved")}</span>
          ) : null}
        </p>
      </div>
      {status.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${status.error}`)}
        </p>
      ) : null}
    </form>
  );
}
