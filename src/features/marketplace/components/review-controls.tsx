"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewListingAction } from "../actions";

/** Décision de l'équipe Get iT : approuver, ou refuser avec une raison. */
export function ReviewControls({ listingId }: { listingId: string }) {
  const t = useTranslations("Marketplace.approvals");
  const id = useId();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    setFailed(false);
    startTransition(async () => {
      const done = await reviewListingAction({ listingId, approve, note });
      if (!done) setFailed(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            {t("noteLabel")}
          </label>
          <Textarea
            id={`${id}-note`}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <Button
              variant="destructive"
              disabled={pending || note.trim() === ""}
              onClick={() => decide(false)}
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <X aria-hidden="true" />
              )}
              {t("rejectConfirm")}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button disabled={pending} onClick={() => decide(true)}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {t("approve")}
            </Button>
            <Button variant="outline" onClick={() => setRejecting(true)}>
              {t("reject")}
            </Button>
          </>
        )}
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      ) : null}
    </div>
  );
}
