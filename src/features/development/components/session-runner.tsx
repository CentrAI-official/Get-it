"use client";

import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type RunnerItem = {
  kicker: string | null;
  name: string;
  sub: string | null;
  /** Fiche du catalogue, s'il y en a une. */
  ref: string | null;
};

/**
 * « Commencer » : la séance du jour, un élément à la fois, en plein écran sur
 * téléphone (comme le mode Focus de « Ma journée »). Rien n'est enregistré.
 */
export function SessionRunner({
  open,
  onOpenChange,
  title,
  items,
  mediaLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: RunnerItem[];
  /** « Voir la démo », « Voir la recette »… ; null sans catalogue. */
  mediaLabel: string | null;
}) {
  const t = useTranslations("Development.plan.runner");
  const [step, setStep] = useState(0);
  const finished = step >= items.length;
  const item = items[Math.min(step, items.length - 1)];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStep(0);
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,calc(100dvh-4rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:ring-1"
        onClickCapture={(event) => {
          // La fiche s'ouvre dans la page : la séance se ferme
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            onOpenChange(false);
          }
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>

        <div
          role="progressbar"
          aria-label={t("progressLabel")}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={Math.min(step + 1, items.length)}
          className="mr-12 flex gap-1.5"
        >
          {items.map((entry, index) => (
            <span
              key={`${entry.name}-${index}`}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index <= step ? "bg-primary" : "bg-foreground/10",
              )}
            />
          ))}
        </div>

        {finished ? (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
          >
            <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check aria-hidden="true" className="size-9" strokeWidth={3} />
            </span>
            <p className="font-display text-5xl tracking-wide uppercase">
              {t("doneTitle")}
            </p>
            <p className="max-w-xs text-pretty text-muted-foreground">
              {t("doneText", { title })}
            </p>
            <Button
              size="lg"
              className="mt-2"
              onClick={() => onOpenChange(false)}
            >
              {t("close")}
            </Button>
          </div>
        ) : item ? (
          <>
            <div className="flex flex-1 flex-col justify-center gap-4 py-8">
              <span className="caps-label text-muted-foreground">
                {t("step", { current: step + 1, total: items.length })}
              </span>
              {item.kicker ? (
                <span className="font-display text-3xl tracking-wide text-primary uppercase">
                  {item.kicker}
                </span>
              ) : null}
              <h2 className="font-display text-5xl leading-none tracking-wide text-balance uppercase">
                {item.name}
              </h2>
              {item.sub ? (
                <p className="text-lg text-muted-foreground">{item.sub}</p>
              ) : null}
              {item.ref && mediaLabel ? (
                <Button asChild variant="outline" className="mt-2 w-fit">
                  <Link href={`/services/library/${item.ref}`}>
                    <Play aria-hidden="true" />
                    {mediaLabel}
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="lg"
                disabled={step === 0}
                onClick={() => setStep((current) => current - 1)}
              >
                <ArrowLeft aria-hidden="true" />
                {t("previous")}
              </Button>
              <Button
                size="lg"
                onClick={() => setStep((current) => current + 1)}
              >
                {step === items.length - 1 ? t("finish") : t("next")}
                {step === items.length - 1 ? (
                  <Check aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
