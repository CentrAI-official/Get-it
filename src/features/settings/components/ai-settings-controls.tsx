"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  deleteCoachConversationsAction,
  setAiConsentAction,
} from "@/features/coach/actions";

type AiSettingsControlsProps = {
  consented: boolean;
  /** Conversations enregistrées avec Get iT AI. */
  conversations: number;
};

/** Donner ou retirer l'accord, et effacer les conversations. */
export function AiSettingsControls({
  consented,
  conversations,
}: AiSettingsControlsProps) {
  const t = useTranslations("App.settings.ai");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={consented ? "outline" : "default"}
          disabled={pending}
          onClick={() => startTransition(() => setAiConsentAction(!consented))}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          {consented ? t("revoke") : t("grant")}
        </Button>
        {conversations > 0 ? (
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
                {t("deleteConversations")}
              </Button>
            }
            title={t("deleteTitle")}
            description={t("deleteDescription", { count: conversations })}
            confirmLabel={t("deleteConfirm")}
            pendingLabel={t("deleting")}
            cancelLabel={t("cancel")}
            errorMessage={t("deleteError")}
            action={deleteCoachConversationsAction}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("conversations", { count: conversations })}
      </p>
    </div>
  );
}
