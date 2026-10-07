"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { forgotPasswordAction } from "../actions";
import { initialAuthFormState } from "../form-state";
import { AuthSuccess } from "./auth-success";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialAuthFormState,
  );

  if (state.status === "success") {
    return (
      <AuthSuccess
        title={t("forgotPassword.successTitle")}
        description={t("forgotPassword.successDescription", {
          email: state.email ?? "",
        })}
        hint={t("signup.successHint")}
      />
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <FormAlert error={state.error} />
      <FormField
        name="email"
        type="email"
        label={t("fields.email")}
        placeholder={t("fields.emailPlaceholder")}
        autoComplete="email"
        required
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton
        pending={pending}
        pendingLabel={t("forgotPassword.pending")}
      >
        {t("forgotPassword.submit")}
      </SubmitButton>
    </form>
  );
}
