"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ITEM_TITLE_MAX_LENGTH,
  initialItemFormState,
} from "@/features/goals/schemas";
import { updateTaskAction } from "../actions";

type TaskEditDialogProps = {
  task: { id: string; title: string; dueDate: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La tâche a été enregistrée (le calendrier se met à jour). */
  onSaved: () => void;
};

/** Renommer une tâche ou changer son échéance, depuis le calendrier. */
export function TaskEditDialog({
  task,
  open,
  onOpenChange,
  onSaved,
}: TaskEditDialogProps) {
  const t = useTranslations("Development.calendar.taskEdit");
  const tErrors = useTranslations("Goals.errors");
  const id = useId();
  const [state, action, pending] = useActionState(
    updateTaskAction.bind(null, task.id),
    initialItemFormState,
  );

  // Enregistrée : la fenêtre se ferme et le calendrier se recharge
  const saved = state.status === "success";
  useEffect(() => {
    if (saved) onSaved();
  }, [saved, onSaved]);

  return (
    <Dialog open={open && !saved} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-title`}>{t("name")}</Label>
            <Input
              id={`${id}-title`}
              name="title"
              defaultValue={task.title}
              maxLength={ITEM_TITLE_MAX_LENGTH}
              required
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-due`}>{t("due")}</Label>
            <Input
              id={`${id}-due`}
              name="dueDate"
              type="date"
              defaultValue={task.dueDate ?? ""}
              className="h-10"
            />
          </div>
          {state.status === "error" && state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(state.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
