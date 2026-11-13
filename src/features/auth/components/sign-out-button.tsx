"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { removePushSubscriptionAction } from "@/features/notifications/actions";
import { signOutAction } from "../actions";

type SignOutButtonProps = Pick<
  ComponentProps<typeof Button>,
  "variant" | "className"
>;

/**
 * Cet appareil ne reçoit plus les notifications du compte : sans ça, un
 * téléphone partagé montrerait celles de la personne qui vient de partir.
 * N'empêche jamais la déconnexion.
 */
async function forgetThisDevice() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    // Le serveur d'abord, tant que la session est ouverte
    await removePushSubscriptionAction(subscription.endpoint).catch(
      () => undefined,
    );
    await subscription.unsubscribe();
  } catch {
    // Navigateur sans notifications ou refus : on se déconnecte quand même
  }
}

export function SignOutButton({
  variant = "outline",
  className,
}: SignOutButtonProps) {
  const locale = useLocale();

  return (
    <form
      action={async (formData) => {
        await forgetThisDevice();
        await signOutAction(formData);
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <SignOutSubmit variant={variant} className={className} />
    </form>
  );
}

function SignOutSubmit({ variant, className }: SignOutButtonProps) {
  const t = useTranslations("Auth.signOut");
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
    >
      <LogOut aria-hidden="true" />
      {pending ? t("pending") : t("label")}
    </Button>
  );
}
