"use client";

import { BadgeCheck, LoaderCircle, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setAccountTypeAction } from "../actions";

/** Un consommateur qui veut vendre : passer en compte affilié. */
export function BecomeAffiliate() {
  const t = useTranslations("Marketplace.affiliate");
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex max-w-2xl flex-col gap-5">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary glow-primary">
        <Store aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {(["sell", "review", "verify"] as const).map((key) => (
          <li key={key} className="flex items-start gap-2">
            <BadgeCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-silver"
            />
            {t(`points.${key}`)}
          </li>
        ))}
      </ul>
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setAccountTypeAction("affiliate");
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {t("action")}
      </Button>
    </section>
  );
}
