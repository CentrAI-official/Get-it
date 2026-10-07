"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { FieldGroup } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { signInAction } from "../actions";
import { isAuthErrorKey } from "../errors";
import { initialAuthFormState } from "../form-state";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function LoginForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialAuthFormState,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <Suspense fallback={null}>
        <UrlParams showLinkError={state.status === "idle"} />
      </Suspense>
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
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
          labelAction={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("login.forgotPassword")}
            </Link>
          }
        />
      </FieldGroup>
      <SubmitButton pending={pending} pendingLabel={t("login.pending")}>
        {t("login.submit")}
      </SubmitButton>
    </form>
  );
}

/**
 * Lit l'URL : la page à rouvrir après la connexion (`next`) et l'erreur
 * d'un lien reçu par courriel (`error`). Isolé dans un Suspense pour que le
 * reste du formulaire reste dans la page prérendue.
 */
function UrlParams({ showLinkError }: { showLinkError: boolean }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const error = searchParams.get("error");

  return (
    <>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {showLinkError && isAuthErrorKey(error) ? (
        <FormAlert error={error} />
      ) : null}
    </>
  );
}
