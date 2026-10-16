"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reportAction } from "../actions";
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  type CommunityError,
} from "../rules";

type ReportDialogProps = {
  target: { type: "post" | "comment" | "user"; id: string } | null;
  onClose: () => void;
  /** Signalement envoyé : message de confirmation. */
  onReported: () => void;
};

/** Signaler un contenu ou une personne à la modération. */
export function ReportDialog({
  target,
  onClose,
  onReported,
}: ReportDialogProps) {
  const t = useTranslations("Community.report");
  const tErrors = useTranslations("Community.errors");
  const id = useId();
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number] | "">(
    "",
  );
  const [details, setDetails] = useState("");
  const [error, setError] = useState<CommunityError | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setReason("");
    setDetails("");
    setError(null);
    onClose();
  }

  function submit() {
    if (!target || !reason) return;
    startTransition(async () => {
      const result = await reportAction({
        target,
        reason,
        details: details || undefined,
      });
      if (result.ok) {
        close();
        onReported();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => !open && close()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`title.${target?.type ?? "post"}`)}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <RadioGroupPrimitive.Root
          aria-label={t("reasonLabel")}
          value={reason}
          onValueChange={(value) => setReason(value as typeof reason)}
          className="flex flex-col gap-2"
        >
          {REPORT_REASONS.map((value) => (
            <RadioGroupPrimitive.Item
              key={value}
              value={value}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10"
            >
              {t(`reasons.${value}`)}
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
        <label htmlFor={`${id}-details`} className="sr-only">
          {t("detailsLabel")}
        </label>
        <Textarea
          id={`${id}-details`}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t("detailsPlaceholder")}
          maxLength={REPORT_DETAILS_MAX_LENGTH}
          className="min-h-16 rounded-xl"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {tErrors(error)}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!reason || pending}
            onClick={submit}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
