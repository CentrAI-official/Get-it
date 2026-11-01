"use client";

import { Eye, EyeOff, LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Country, Sex } from "@/features/profile/details";
import { eraseLevelsAction, setRankedAction } from "../actions";
import type { LevelFactor } from "../factors";
import { MeasureForm } from "./measure-form";

/**
 * Refaire une mesure (ou la faire, si elle manque) dans une fenêtre ; après
 * l'envoi, le niveau du pilier avant et après. `defaultOpen` : ouverte depuis
 * un objectif de niveau (« Mettre à jour ma mesure »).
 */
export function MeasureDialog({
  factor,
  label,
  consentRequired,
  country,
  sex,
  defaultOpen = false,
}: {
  factor: LevelFactor;
  label: string;
  consentRequired: boolean;
  country: Country;
  sex: Sex;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("Levels.update");
  const tFactors = useTranslations("Levels.factors");
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState<{
    before: number | null;
    after: number | null;
  } | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tFactors(factor)}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {done ? (
          <div role="status" className="flex flex-col items-start gap-4">
            <p className="font-semibold">
              {done.after === null
                ? t("saved")
                : done.before === null || done.before === done.after
                  ? t("level", { level: done.after })
                  : t("levelChanged", { from: done.before, to: done.after })}
            </p>
            <DialogClose asChild>
              <Button>{t("close")}</Button>
            </DialogClose>
          </div>
        ) : (
          <MeasureForm
            factors={[factor]}
            consentRequired={consentRequired}
            country={country}
            sex={sex}
            onSaved={(result) =>
              setDone({ before: result.before, after: result.after })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mode Ranked : niveaux publics et classement, ou niveaux privés. */
export function RankedSwitch({ ranked }: { ranked: boolean }) {
  const t = useTranslations("Levels.ranked");
  const [pending, startTransition] = useTransition();
  const change = (next: boolean) =>
    startTransition(async () => {
      await setRankedAction(next);
    });

  if (ranked) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => change(false)}
        className="w-fit text-muted-foreground"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <EyeOff aria-hidden="true" />
        )}
        {t("leave")}
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit">
          <Eye aria-hidden="true" className="text-primary" />
          {t("join")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("joinTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("joinDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              change(true);
            }}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Effacer toutes ses mesures (Loi 25) : niveaux et objectifs de niveau en cours. */
export function EraseLevels() {
  const t = useTranslations("Levels.erase");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-fit text-muted-foreground">
          <Trash2 aria-hidden="true" />
          {t("open")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await eraseLevelsAction();
                setOpen(false);
              });
            }}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
