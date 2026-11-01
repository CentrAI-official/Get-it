"use client";

import {
  CircleCheck,
  Handshake,
  LoaderCircle,
  MessageCircle,
  NotebookPen,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { answerWeekQuestionAction } from "../actions";
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_TOPICS,
  type FeedbackTopic,
} from "../rules";

const TOPIC_ICONS = {
  community: Users,
  messages: MessageCircle,
  development: Handshake,
  goals: Target,
  journal: NotebookPen,
  coach: Sparkles,
  marketplace: ShoppingBag,
  ranked: Trophy,
} as const;

/**
 * « Qu'est-ce qui t'aide le plus? », posée une seule fois, après une semaine.
 * Fermer la fenêtre vaut « Non merci » : elle ne revient pas.
 */
export function WeekQuestionDialog() {
  const t = useTranslations("Feedback.week");
  const id = useId();
  const [open, setOpen] = useState(true);
  const [topic, setTopic] = useState<FeedbackTopic | "">("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function answer(value: { topic: FeedbackTopic; body: string } | null) {
    setFailed(false);
    startTransition(async () => {
      const ok = await answerWeekQuestionAction(value);
      if (!ok) {
        setFailed(true);
        return;
      }
      if (value) setSent(true);
      else setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        // Fermer sans répondre : la question ne reviendra pas
        if (!value && !sent && !pending) answer(null);
        if (!value && sent) setOpen(false);
      }}
    >
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[90dvh] overflow-y-auto"
      >
        {sent ? (
          <div role="status" className="flex flex-col items-start gap-3 py-2">
            <CircleCheck aria-hidden="true" className="size-8 text-primary" />
            <DialogTitle>{t("thanks")}</DialogTitle>
            <DialogDescription>{t("thanksDetail")}</DialogDescription>
            <Button className="mt-2" onClick={() => setOpen(false)}>
              {t("close")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <RadioGroupPrimitive.Root
              aria-label={t("title")}
              value={topic}
              onValueChange={(value) => setTopic(value as FeedbackTopic)}
              className="grid grid-cols-2 gap-2"
            >
              {FEEDBACK_TOPICS.map((value) => {
                const Icon = TOPIC_ICONS[value];
                return (
                  <RadioGroupPrimitive.Item
                    key={value}
                    value={value}
                    className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5 text-left text-sm font-medium transition-colors outline-none hover:bg-foreground/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/10"
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                    {t(`topics.${value}`)}
                  </RadioGroupPrimitive.Item>
                );
              })}
            </RadioGroupPrimitive.Root>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-body`} className="text-sm font-medium">
                {t("bodyLabel")}
              </label>
              <Textarea
                id={`${id}-body`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={FEEDBACK_MAX_LENGTH}
                placeholder={t("bodyPlaceholder")}
                className="min-h-20 rounded-xl"
              />
            </div>
            {failed ? (
              <p role="alert" className="text-sm text-destructive">
                {t("error")}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => answer(null)}
              >
                {t("decline")}
              </Button>
              <Button
                disabled={!topic || pending}
                onClick={() => topic && answer({ topic, body })}
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                {t("submit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
