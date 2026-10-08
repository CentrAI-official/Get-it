"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteHabitAction, setHabitArchivedAction } from "../actions";

type HabitManageProps = { habitId: string; archived: boolean };

/** Mettre en pause, reprendre ou supprimer une habitude. */
export function HabitManage({ habitId, archived }: HabitManageProps) {
  const t = useTranslations("Habits.manage");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-3">
      {archived ? (
        <p className="text-sm text-muted-foreground">{t("pausedNote")}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ArchiveButton
          habitId={habitId}
          archived={!archived}
          label={archived ? t("resume") : t("pause")}
        />
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              {t("delete")}
            </Button>
          }
          title={t("deleteTitle")}
          description={t("deleteDescription")}
          confirmLabel={t("deleteConfirm")}
          pendingLabel={t("deleting")}
          cancelLabel={t("cancel")}
          errorMessage={t("deleteError")}
          action={deleteHabitAction.bind(null, habitId)}
          fields={{ locale }}
        />
      </div>
    </div>
  );
}

type ArchiveButtonProps = {
  habitId: string;
  /** État visé : true pour mettre en pause. */
  archived: boolean;
  label: string;
  variant?: "outline" | "ghost";
};

/** Met en pause ou reprend une habitude (aussi utilisé dans la liste des habitudes en pause). */
export function ArchiveButton({
  habitId,
  archived,
  label,
  variant = "outline",
}: ArchiveButtonProps) {
  // Icône choisie ici : un composant serveur ne peut pas passer de fonction à un composant client
  return (
    <form action={setHabitArchivedAction.bind(null, habitId, archived)}>
      <ArchiveSubmit archived={archived} label={label} variant={variant} />
    </form>
  );
}

function ArchiveSubmit({
  archived,
  label,
  variant,
}: Pick<ArchiveButtonProps, "archived" | "label" | "variant">) {
  const { pending } = useFormStatus();
  const Icon = archived ? Pause : Play;
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}
