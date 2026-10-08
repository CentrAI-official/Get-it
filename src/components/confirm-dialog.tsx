"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, type ReactNode } from "react";
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

export type ConfirmState = { status: "idle" | "error" };

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
  /** Server Action exécutée à la confirmation (redirige en cas de succès). */
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
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <AlertDialog>
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
