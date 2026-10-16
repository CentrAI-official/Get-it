"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { unblockUserAction } from "../actions";

/** Débloquer une personne (Réglages). */
export function UnblockButton({ userId }: { userId: string }) {
  const t = useTranslations("Community.settings");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => unblockUserAction(userId))}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : null}
      {t("unblock")}
    </Button>
  );
}
