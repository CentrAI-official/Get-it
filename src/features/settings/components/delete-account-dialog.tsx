"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteAccountAction } from "../actions";

/** Bouton de suppression du compte, avec confirmation (action irréversible). */
export function DeleteAccountDialog() {
  const t = useTranslations("App.settings.deleteAccount");
  const locale = useLocale();

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive">
          <Trash2 aria-hidden="true" />
          {t("button")}
        </Button>
      }
      title={t("confirmTitle")}
      description={t("confirmDescription")}
      confirmLabel={t("confirm")}
      pendingLabel={t("pending")}
      cancelLabel={t("cancel")}
      errorMessage={t("error")}
      action={deleteAccountAction}
      fields={{ locale }}
    />
  );
}
