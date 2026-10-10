"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { deleteGoalAction, setGoalStatusAction } from "../actions";
import type { GoalStatus } from "../schemas";

type GoalActionsProps = { goalId: string; status: GoalStatus };

/** Modifier, atteindre, reprendre, archiver ou supprimer un objectif. */
export function GoalActions({ goalId, status }: GoalActionsProps) {
  const t = useTranslations("Goals.detail");
  const locale = useLocale();

  return (
    <div
      role="group"
      aria-label={t("actionsLabel")}
      className="flex flex-wrap items-center gap-2"
    >
      {status === "active" ? (
        <StatusButton
          goalId={goalId}
          status="completed"
          icon={Check}
          label={t("complete")}
          variant="default"
        />
      ) : null}
      <Button asChild variant="outline">
        <Link href={`/goals/${goalId}/edit`} title={t("edit")}>
          <Pencil aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t("edit")}</span>
        </Link>
      </Button>
      {status === "completed" ? (
        <StatusButton
          goalId={goalId}
          status="active"
          icon={RotateCcw}
          label={t("reopen")}
          variant="outline"
        />
      ) : null}
      {status === "archived" ? (
        <StatusButton
          goalId={goalId}
          status="active"
          icon={ArchiveRestore}
          label={t("unarchive")}
          variant="outline"
        />
      ) : (
        <StatusButton
          goalId={goalId}
          status="archived"
          icon={Archive}
          label={t("archive")}
          variant="ghost"
          compact
        />
      )}
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            title={t("delete")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t("delete")}</span>
          </Button>
        }
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        confirmLabel={t("deleteConfirm")}
        pendingLabel={t("deleting")}
        cancelLabel={t("cancel")}
        errorMessage={t("deleteError")}
        action={deleteGoalAction.bind(null, goalId)}
        fields={{ locale }}
      />
    </div>
  );
}

type StatusButtonProps = {
  goalId: string;
  status: GoalStatus;
  icon: LucideIcon;
  label: string;
  variant: ComponentProps<typeof Button>["variant"];
  /** Icône seule sur téléphone (le libellé reste lu par les lecteurs d'écran). */
  compact?: boolean;
};

function StatusButton({ goalId, status, ...button }: StatusButtonProps) {
  return (
    <form action={setGoalStatusAction.bind(null, goalId, status)}>
      <StatusSubmit {...button} />
    </form>
  );
}

function StatusSubmit({
  icon: Icon,
  label,
  variant,
  compact,
}: Omit<StatusButtonProps, "goalId" | "status">) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      title={compact ? label : undefined}
    >
      <Icon aria-hidden="true" />
      {compact ? (
        <span className="sr-only sm:not-sr-only">{label}</span>
      ) : (
        label
      )}
    </Button>
  );
}
