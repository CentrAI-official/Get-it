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
import { useState, useTransition, type ComponentProps } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { deleteGoalAction, setGoalStatusAction } from "../actions";
import type { GoalStatus } from "../schemas";

type GoalActionsProps = { goalId: string; status: GoalStatus };

/** Modifier, atteindre, reprendre, archiver ou supprimer un objectif. */
export function GoalActions({ goalId, status }: GoalActionsProps) {
  const t = useTranslations("Goals.detail");
  const tErrors = useTranslations("Goals.errors");
  const locale = useLocale();
  // Reprendre un objectif : refusé si l'aspect a déjà 3 objectifs en cours
  const [limit, setLimit] = useState(false);
  const status_ = { goalId, onLimit: () => setLimit(true) };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t("actionsLabel")}
        className="flex flex-wrap items-center gap-2"
      >
        {status === "active" ? (
          <StatusButton
            {...status_}
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
            {...status_}
            status="active"
            icon={RotateCcw}
            label={t("reopen")}
            variant="outline"
          />
        ) : null}
        {status === "archived" ? (
          <StatusButton
            {...status_}
            status="active"
            icon={ArchiveRestore}
            label={t("unarchive")}
            variant="outline"
          />
        ) : (
          <StatusButton
            {...status_}
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
      {limit ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors("goalLimit")}
        </p>
      ) : null}
    </div>
  );
}

type StatusButtonProps = {
  goalId: string;
  status: GoalStatus;
  onLimit: () => void;
  icon: LucideIcon;
  label: string;
  variant: ComponentProps<typeof Button>["variant"];
  /** Icône seule sur téléphone (le libellé reste lu par les lecteurs d'écran). */
  compact?: boolean;
};

function StatusButton({
  goalId,
  status,
  onLimit,
  icon: Icon,
  label,
  variant,
  compact,
}: StatusButtonProps) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      title={compact ? label : undefined}
      onClick={() =>
        startTransition(async () => {
          const result = await setGoalStatusAction(goalId, status);
          if (result.error === "goalLimit") onLimit();
        })
      }
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
