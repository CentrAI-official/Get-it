"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createGroupAction,
  updateGroupAction,
  type GroupFormState,
} from "../actions";
import {
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  GROUP_TOPICS,
  GROUP_VISIBILITIES,
  type GroupTopic,
  type GroupVisibility,
} from "../rules";
import { GroupBadge } from "./group-badge";

const choice =
  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const choiceOn = "border-primary bg-primary/10";
const choiceOff =
  "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]";

const initial: GroupFormState = { status: "idle" };

type GroupFormProps = {
  /** Modification d'un groupe existant ; sinon, création. */
  group?: {
    id: string;
    name: string;
    description: string;
    topic: GroupTopic;
    visibility: GroupVisibility;
  };
};

/** Créer ou modifier un groupe : nom, description, sujet et type (à la création). */
export function GroupForm({ group }: GroupFormProps) {
  const t = useTranslations("Groups");
  const locale = useLocale();
  const id = useId();
  const [state, formAction, pending] = useActionState(
    group ? updateGroupAction : createGroupAction,
    initial,
  );
  const [topic, setTopic] = useState<GroupTopic>(group?.topic ?? "general");
  const [visibility, setVisibility] = useState<GroupVisibility>(
    group?.visibility ?? "public",
  );

  return (
    <form
      action={formAction}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="visibility" value={visibility} />
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          {t("form.name")}
        </label>
        <Input
          id={`${id}-name`}
          name="name"
          defaultValue={state.values?.name ?? group?.name}
          placeholder={t("form.namePlaceholder")}
          maxLength={GROUP_NAME_MAX}
          required
          className="h-10"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">
          {t("form.description")}{" "}
          <span className="font-normal text-muted-foreground">
            ({t("form.optional")})
          </span>
        </label>
        <Textarea
          id={`${id}-description`}
          name="description"
          defaultValue={state.values?.description ?? group?.description}
          placeholder={t("form.descriptionPlaceholder")}
          maxLength={GROUP_DESCRIPTION_MAX}
          rows={3}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("form.topic")}</legend>
        <div
          role="radiogroup"
          aria-label={t("form.topic")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {GROUP_TOPICS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={topic === value}
              onClick={() => setTopic(value)}
              className={cn(choice, topic === value ? choiceOn : choiceOff)}
            >
              <GroupBadge topic={value} className="size-8" />
              <span className="text-sm font-semibold">
                {t(`topics.${value}`)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          {t("form.visibility")}
        </legend>
        {group ? (
          <p className="text-sm text-muted-foreground">
            {t(`visibility.${group.visibility}`)} · {t("form.visibilityLocked")}
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label={t("form.visibility")}
            className="grid gap-2 sm:grid-cols-2"
          >
            {GROUP_VISIBILITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={visibility === value}
                onClick={() => setVisibility(value)}
                className={cn(
                  choice,
                  "flex-col items-start gap-1",
                  visibility === value ? choiceOn : choiceOff,
                )}
              >
                <span className="font-semibold">
                  {t(`visibility.${value}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`visibilityHints.${value}`)}
                </span>
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-10 w-fit">
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {group
          ? pending
            ? t("form.saving")
            : t("form.save")
          : pending
            ? t("form.creating")
            : t("form.create")}
      </Button>
    </form>
  );
}
