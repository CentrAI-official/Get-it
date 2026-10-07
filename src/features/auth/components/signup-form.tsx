"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldGroup } from "@/components/ui/field";
import { signUpAction } from "../actions";
import { initialAuthFormState } from "../form-state";
import { PASSWORD_MIN_LENGTH } from "../schemas";
import { AuthSuccess } from "./auth-success";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

/** Renseigne le fuseau du navigateur, inconnu du serveur (sert à calculer « aujourd'hui »). */
function fillBrowserTimeZone(input: HTMLInputElement | null) {
  if (input) input.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function SignupForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialAuthFormState,
  );

  if (state.status === "success") {
    return (
      <AuthSuccess
        title={t("signup.successTitle")}
        description={t("signup.successDescription", {
          email: state.email ?? "",
        })}
        hint={t("signup.successHint")}
      />
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="timeZone" ref={fillBrowserTimeZone} />
      <FormAlert error={state.error} />
      <FieldGroup>
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
        <FormField
          name="password"
          type="password"
          label={t("fields.password")}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          description={t("fields.passwordHint", { min: PASSWORD_MIN_LENGTH })}
          error={state.fieldErrors?.password}
        />
      </FieldGroup>
      <SubmitButton pending={pending} pendingLabel={t("signup.pending")}>
        {t("signup.submit")}
      </SubmitButton>
    </form>
  );
}
