"use client";

import { LoaderCircle, MessageCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/features/messages/actions";
import { useRouter } from "@/i18n/navigation";
import { deleteListingAction } from "../actions";

/** Écrire au vendeur dans la Messagerie (le paiement viendra ensuite). */
export function ContactSeller({ sellerId }: { sellerId: string }) {
  const t = useTranslations("Marketplace.detail");
  const tErrors = useTranslations("Messages.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-1 flex-col gap-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startConversationAction(sellerId);
            if (result.ok) router.push(`/messages/${result.id}`);
            else setError(tErrors(result.error));
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <MessageCircle aria-hidden="true" />
        )}
        {t("contact")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Le vendeur retire son annonce, après confirmation. */
export function DeleteListing({ listingId }: { listingId: string }) {
  const t = useTranslations("Marketplace.detail");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (await deleteListingAction(listingId)) {
                    setOpen(false);
                    router.replace("/marketplace/mine");
                  }
                })
              }
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
