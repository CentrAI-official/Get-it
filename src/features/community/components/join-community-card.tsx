"use client";

import { LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { joinCommunityAction } from "../actions";
import { initialCommunityState } from "../rules";

const RULES = ["respect", "progress", "safety", "privacy", "honesty"] as const;

/** Rejoindre le Centre : nom d'utilisateur et règles de la communauté. */
export function JoinCommunityCard() {
  const t = useTranslations("Community.join");
  const tErrors = useTranslations("Community.errors");
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState(
    joinCommunityAction,
    initialCommunityState,
  );
  const error = state.status === "error" ? state.error : undefined;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex max-w-2xl flex-col gap-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <Users aria-hidden="true" className="size-5 text-primary" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id={`${id}-title`} className="font-heading text-xl font-bold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <form action={formAction} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="locale" value={locale} />
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-username`} className="text-sm font-medium">
            {t("usernameLabel")}
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            >
              @
            </span>
            <Input
              id={`${id}-username`}
              name="username"
              defaultValue={state.values?.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              aria-invalid={error?.startsWith("username") ? true : undefined}
              aria-describedby={`${id}-username-help`}
              className="h-10 pl-7"
            />
          </div>
          <p
            id={`${id}-username-help`}
            className="text-xs text-muted-foreground"
          >
            {t("usernameHelp")}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/8 pt-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-4 text-silver" />
            {t("rulesTitle")}
          </h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
            {RULES.map((rule) => (
              <li key={rule}>{t(`rules.${rule}`)}</li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm">
            <Checkbox name="rules" value="on" className="mt-0.5" />
            {t("accept")}
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {tErrors(error)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-10 w-fit px-5"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("submit")}
          </Button>
          <Button asChild variant="ghost" size="lg" className="h-10">
            <Link href="/profile">{t("later")}</Link>
          </Button>
        </div>
      </form>
    </section>
  );
}
