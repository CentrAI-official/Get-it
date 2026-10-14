"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
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

/** « success » ferme la boîte (pour une action qui ne redirige pas). */
export type ConfirmState = { status: "idle" | "error" | "success" };

const initialState: ConfirmState = { status: "idle" };

type ConfirmDialogProps = {
  /** Bouton qui ouvre la boîte. */
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  errorMessage: string;
  /** Server Action exécutée à la confirmation : redirige, ou renvoie « success ». */
  action: (state: ConfirmState, formData: FormData) => Promise<ConfirmState>;
  /** Champs cachés envoyés avec la confirmation (ex. la langue). */
  fields?: Record<string, string>;
};

/** Confirmation d'une action destructrice et irréversible. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  errorMessage,
  action,
  fields = {},
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: ConfirmState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    initialState,
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {/* Un simple bouton d'envoi : la boîte reste ouverte pendant l'action */}
        <form action={formAction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {cancelLabel}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                  {pendingLabel}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
