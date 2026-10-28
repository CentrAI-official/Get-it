"use client";

import {
  Check,
  LoaderCircle,
  MessageCircle,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  requestContactAction,
  respondContactAction,
} from "@/features/contacts/actions";
import type { ContactState } from "@/features/contacts/rules";
import { startConversationAction } from "@/features/messages/actions";
import { useRouter } from "@/i18n/navigation";

/** Sur le profil de quelqu'un d'autre : écrire, ou l'ajouter en contact. */
export function ProfileActions({
  userId,
  contactState,
}: {
  userId: string;
  contactState: ContactState;
}) {
  const t = useTranslations("Community.profile");
  const tMessages = useTranslations("Messages.errors");
  const tContacts = useTranslations("Contacts.errors");
  const router = useRouter();
  const [state, setState] = useState(contactState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function write() {
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction(userId);
      if (result.ok) router.push(`/messages/${result.id}`);
      else setError(tMessages(result.error));
    });
  }

  function contact() {
    setError(null);
    startTransition(async () => {
      if (state === "received") {
        if (await respondContactAction(userId, true)) setState("contact");
        return;
      }
      const result = await requestContactAction(userId);
      if (result.ok) setState(result.state);
      else setError(tContacts(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={write}>
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <MessageCircle aria-hidden="true" />
          )}
          {t("write")}
        </Button>
        {state === "contact" ? (
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-foreground/6 px-3.5 text-sm font-medium text-muted-foreground">
            <UserCheck aria-hidden="true" className="size-4" />
            {t("isContact")}
          </span>
        ) : state === "sent" ? (
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-primary/12 px-3.5 text-sm font-medium text-primary">
            <Check aria-hidden="true" className="size-4" />
            {t("requested")}
          </span>
        ) : (
          <Button variant="outline" disabled={pending} onClick={contact}>
            <UserPlus aria-hidden="true" />
            {t(state === "received" ? "accept" : "addContact")}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
