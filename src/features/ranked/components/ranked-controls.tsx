"use client";

import { LoaderCircle, LogOut, Sparkles } from "lucide-react";
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
import { useRouter } from "@/i18n/navigation";
import { analyzeRankedAction, leaveRankedAction } from "../actions";
import type { RankedError } from "../rules";

/** Demande l'analyse du niveau à Get iT AI (une fois par évaluation). */
export function RankedAnalyzeButton() {
  const t = useTranslations("Ranked.analysis");
  const tErrors = useTranslations("Ranked.errors");
  const [error, setError] = useState<RankedError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await analyzeRankedAction();
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Sparkles aria-hidden="true" className="text-primary" />
        )}
        {pending ? t("loading") : t("request")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(error)}
        </p>
      ) : null}
    </div>
  );
}

/** Quitter le mode Ranked : réponses et niveaux effacés, retour au niveau de l'XP. */
export function LeaveRanked() {
  const t = useTranslations("Ranked.leave");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-fit text-muted-foreground">
          <LogOut aria-hidden="true" />
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
                await leaveRankedAction();
                router.push("/profile");
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
