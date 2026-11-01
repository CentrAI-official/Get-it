"use client";

import {
  CircleCheck,
  Heart,
  Lightbulb,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedbackAction, type FeedbackFormState } from "../actions";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  type FeedbackKind,
} from "../rules";

const KIND_ICONS = {
  idea: Lightbulb,
  problem: TriangleAlert,
  praise: Heart,
} as const;
const initialState: FeedbackFormState = { status: "idle" };

/** Réglages › Donner mon avis : une idée, un problème ou ce qu'on aime. */
export function FeedbackForm() {
  const t = useTranslations("Feedback");
  const locale = useLocale();
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [state, action, pending] = useActionState(
    sendFeedbackAction,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col items-start gap-4">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck aria-hidden="true" className="size-5 text-primary" />
          {t("sent")}
        </p>
        <p className="text-sm text-muted-foreground">{t("sentDetail")}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-col gap-3">
        <span id={`${id}-kind`} className="text-sm font-medium">
          {t("kindLabel")}
        </span>
        <RadioGroupPrimitive.Root
          aria-labelledby={`${id}-kind`}
          value={kind}
          onValueChange={(value) => setKind(value as FeedbackKind)}
          className="flex flex-wrap gap-2"
        >
          {FEEDBACK_KINDS.map((value) => {
            const Icon = KIND_ICONS[value];
            return (
              <RadioGroupPrimitive.Item
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm font-medium transition-colors outline-none hover:bg-foreground/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10"
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(`kinds.${value}`)}
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-body`} className="text-sm font-medium">
          {t(`bodyLabel.${kind}`)}
        </label>
        <Textarea
          id={`${id}-body`}
          name="body"
          required
          minLength={3}
          maxLength={FEEDBACK_MAX_LENGTH}
          placeholder={t(`placeholder.${kind}`)}
          className="min-h-36 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {t("submit")}
      </Button>
    </form>
  );
}
