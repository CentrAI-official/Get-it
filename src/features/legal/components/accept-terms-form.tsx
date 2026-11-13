"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { acceptTermsAction, type AcceptTermsState } from "../actions";

const linkClass = "font-medium text-primary underline-offset-4 hover:underline";

/** « J'ai lu et j'accepte », pour les membres d'avant la mise en ligne des conditions. */
export function AcceptTermsForm() {
  const t = useTranslations("Legal.accept");
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState<
    AcceptTermsState,
    FormData
  >(acceptTermsAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          name="terms"
          value="on"
          required
          aria-invalid={state.error === "required" ? true : undefined}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="text-pretty">
          {t.rich("checkbox", {
            terms: (chunks) => (
              <Link href="/terms" target="_blank" className={linkClass}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" target="_blank" className={linkClass}>
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(state.error === "required" ? "required" : "error")}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-fit" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {t("submit")}
      </Button>
    </form>
  );
}
