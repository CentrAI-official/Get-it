"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { FieldGroup } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { signUpAction } from "../actions";
import { initialAuthFormState } from "../form-state";
import { PASSWORD_MIN_LENGTH } from "../schemas";
import { AuthSuccess } from "./auth-success";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

/** Renseigne le fuseau du navigateur, inconnu du serveur (sert à calculer « aujourd'hui »). */
function fillBrowserTimeZone(input: HTMLInputElement | null) {
  if (input) input.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * `inviteRequired` : bêta privée, un code d'invitation est demandé.
 * `termsRequired` : les conditions et la politique sont en ligne (Loi 25), à accepter.
 */
export function SignupForm({
  inviteRequired,
  termsRequired,
}: {
  inviteRequired: boolean;
  termsRequired: boolean;
}) {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Auth.errors");
  const termsId = useId();
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
        <FormField
          name="confirmPassword"
          type="password"
          label={t("fields.confirmPassword")}
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirmPassword}
        />
        {inviteRequired ? (
          <FormField
            name="inviteCode"
            label={t("fields.inviteCode")}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            description={t("fields.inviteCodeHint")}
            error={state.fieldErrors?.inviteCode}
          />
        ) : null}
        {termsRequired ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={termsId}
              className="flex min-h-11 items-start gap-3 text-sm"
            >
              <input
                id={termsId}
                type="checkbox"
                name="terms"
                value="on"
                required
                aria-invalid={state.fieldErrors?.terms ? true : undefined}
                aria-describedby={
                  state.fieldErrors?.terms ? `${termsId}-error` : undefined
                }
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="text-pretty">
                {t.rich("signup.terms", {
                  terms: (chunks) => (
                    <Link
                      href="/terms"
                      target="_blank"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                  privacy: (chunks) => (
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {state.fieldErrors?.terms ? (
              <p id={`${termsId}-error`} className="text-sm text-destructive">
                {tErrors(state.fieldErrors.terms)}
              </p>
            ) : null}
          </div>
        ) : null}
      </FieldGroup>
      <SubmitButton pending={pending} pendingLabel={t("signup.pending")}>
        {t("signup.submit")}
      </SubmitButton>
    </form>
  );
}
