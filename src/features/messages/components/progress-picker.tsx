"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ProgressShare } from "@/features/community/components/progress-share";
import type { ProgressData } from "@/features/community/rules";
import { cn } from "@/lib/utils";
import type {
  ProgressSource,
  ShareableProgress,
} from "@/server/community/posts";
import { listShareableProgressAction } from "../actions";
import { MESSAGE_MAX_LENGTH } from "../rules";

type ProgressPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (choice: {
    source: ProgressSource;
    progress: ProgressData;
    body: string;
  }) => void;
};

const keyOf = (item: ShareableProgress) =>
  item.source.type === "level"
    ? "level"
    : `${item.source.type}:${item.source.id}`;

/** Choisir un vrai progrès à envoyer dans la conversation. */
export function ProgressPicker({
  open,
  onOpenChange,
  onSend,
}: ProgressPickerProps) {
  const t = useTranslations("Messages.picker");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
      >
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </div>
        {/* Monté à chaque ouverture : liste à jour, choix remis à zéro */}
        <PickerBody
          onSend={(choice) => {
            onSend(choice);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onSend }: Pick<ProgressPickerProps, "onSend">) {
  const t = useTranslations("Messages.picker");
  const id = useId();
  const [items, setItems] = useState<ShareableProgress[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const chosen = items?.find((item) => keyOf(item) === selected);

  useEffect(() => {
    let active = true;
    void listShareableProgressAction()
      .catch(() => [])
      .then((list) => {
        if (active) setItems(list);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {t("loading")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t("title")}
          className="flex flex-col gap-2"
        >
          {items.map((item) => {
            const key = keyOf(item);
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected === key}
                onClick={() => setSelected(key)}
                className={cn(
                  "rounded-2xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected === key
                    ? "ring-2 ring-primary"
                    : "opacity-80 hover:opacity-100",
                )}
              >
                <ProgressShare progress={item.progress} />
              </button>
            );
          })}
        </div>
      )}
      <label htmlFor={`${id}-note`} className="sr-only">
        {t("note")}
      </label>
      <Textarea
        id={`${id}-note`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("notePlaceholder")}
        maxLength={MESSAGE_MAX_LENGTH}
        className="min-h-16 rounded-2xl"
      />
      <Button
        type="button"
        disabled={!chosen}
        onClick={() => {
          if (!chosen) return;
          onSend({
            source: chosen.source,
            progress: chosen.progress,
            body: note.trim(),
          });
        }}
        className="w-fit self-end"
      >
        <Send aria-hidden="true" />
        {t("send")}
      </Button>
    </>
  );
}
