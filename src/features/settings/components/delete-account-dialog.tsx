"use client";

import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteAccountAction, type DeleteAccountState } from "../actions";

const initialState: DeleteAccountState = { status: "idle" };

/** Bouton de suppression du compte, avec confirmation (action irréversible). */
export function DeleteAccountDialog() {
  const t = useTranslations("App.settings.deleteAccount");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialState,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" />
          {t("button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{t("error")}</AlertDescription>
          </Alert>
        ) : null}
        {/* Un simple bouton d'envoi : la boîte reste ouverte pendant la suppression */}
        <form action={formAction}>
          <input type="hidden" name="locale" value={locale} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                  {t("pending")}
                </>
              ) : (
                t("confirm")
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
