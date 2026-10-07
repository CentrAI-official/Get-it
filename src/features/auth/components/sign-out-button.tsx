"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

type SignOutButtonProps = Pick<
  ComponentProps<typeof Button>,
  "variant" | "className"
>;

export function SignOutButton({
  variant = "outline",
  className,
}: SignOutButtonProps) {
  const locale = useLocale();

  return (
    <form action={signOutAction}>
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
