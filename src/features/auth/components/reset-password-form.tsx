"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldGroup } from "@/components/ui/field";
import { resetPasswordAction } from "../actions";
import { initialAuthFormState } from "../form-state";
import { PASSWORD_MIN_LENGTH } from "../schemas";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <FormAlert error={state.error} />
      <FieldGroup>
        <FormField
          name="password"
          type="password"
          label={t("fields.newPassword")}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          description={t("fields.passwordHint", { min: PASSWORD_MIN_LENGTH })}
          error={state.fieldErrors?.password}
        />
        <FormField
          name="confirmPassword"
          type="password"
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirmPassword}
        />
      </FieldGroup>
      <SubmitButton pending={pending} pendingLabel={t("resetPassword.pending")}>
        {t("resetPassword.submit")}
      </SubmitButton>
    </form>
  );
}
