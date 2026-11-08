"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  REGIONS,
  REGULATED_CATEGORIES,
  SERVICE_CATEGORIES,
} from "@/features/marketplace/rules";
import { cn } from "@/lib/utils";
import { reloadTo } from "@/features/identity/client";
import { savePageAction, type PageFormState } from "../actions";
import {
  handleFromName,
  PAGE_LIMITS,
  type PageError,
  type PageField,
} from "../rules";

const chip =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const chipOn = "border-primary bg-primary/15 text-foreground";
const chipOff =
  "border-foreground/10 text-muted-foreground hover:text-foreground";

export type PageFormValues = {
  name: string;
  handle: string;
  category: string;
  about: string;
  regions: string[];
  website: string;
};

/** Créer ou modifier sa page : nom, adresse, domaine, régions et présentation. */
export function PageForm({
  mode,
  initial,
}: {
  mode: "create" | "update";
  initial: PageFormValues | null;
}) {
  const t = useTranslations("Pages.form");
  const tErrors = useTranslations("Pages.errors");
  const tCategories = useTranslations("Marketplace.categories");
  const tRegions = useTranslations("Marketplace.regions");
  const locale = useLocale();
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  // À la création, l'adresse suit le nom tant qu'on ne l'a pas changée soi-même
  const [handleEdited, setHandleEdited] = useState(mode === "update");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [regions, setRegions] = useState<string[]>(initial?.regions ?? []);
  const [about, setAbout] = useState(initial?.about ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [state, formAction, pending] = useActionState<PageFormState, FormData>(
    async (previous, formData) => {
      const result = await savePageAction(mode, previous, formData);
      // Page créée : on y passe aussitôt (le serveur a choisi la page), application rechargée
      if (result.status === "saved" && mode === "create") {
        reloadTo(locale, "/pro");
      }
      return result;
    },
    { status: "idle" },
  );
  const errorOf = (field: PageField) => {
    const key = state.fieldErrors?.[field];
    return key ? tErrors(key) : null;
  };
  const shownHandle = handleEdited ? handle : handleFromName(name);
  const regulated = REGULATED_CATEGORIES.some((entry) => entry === category);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FieldGroup className="gap-5">
        <Field data-invalid={errorOf("name") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={PAGE_LIMITS.name}
            autoComplete="organization"
            placeholder={t("namePlaceholder")}
            aria-invalid={errorOf("name") ? true : undefined}
            className="h-11"
          />
          {errorOf("name") ? <FieldError>{errorOf("name")}</FieldError> : null}
        </Field>
        <Field data-invalid={errorOf("handle") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-handle`}>{t("handle")}</FieldLabel>
          <div className="flex h-11 items-center rounded-lg border border-input focus-within:ring-3 focus-within:ring-ring/50">
            <span className="pl-3 text-sm text-muted-foreground select-none">
              /pages/
            </span>
            <input
              id={`${id}-handle`}
              name="handle"
              value={shownHandle}
              onChange={(event) => {
                setHandleEdited(true);
                setHandle(event.target.value.toLowerCase());
              }}
              maxLength={PAGE_LIMITS.handleMax}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={errorOf("handle") ? true : undefined}
              aria-describedby={`${id}-handle-hint`}
              className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none"
            />
          </div>
          <FieldDescription id={`${id}-handle-hint`}>
            {t("handleHint")}
          </FieldDescription>
          {errorOf("handle") ? (
            <FieldError>{errorOf("handle")}</FieldError>
          ) : null}
        </Field>
        <FieldSet data-invalid={errorOf("category") ? true : undefined}>
          <FieldLegend variant="label">{t("category")}</FieldLegend>
          <input type="hidden" name="category" value={category} />
          <div
            role="radiogroup"
            aria-label={t("category")}
            className="flex flex-wrap gap-2"
          >
            {SERVICE_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={category === value}
                onClick={() => setCategory(value)}
                className={cn(chip, category === value ? chipOn : chipOff)}
              >
                {tCategories(value)}
              </button>
            ))}
          </div>
          {regulated ? (
            <FieldDescription>{t("regulatedHint")}</FieldDescription>
          ) : null}
          {errorOf("category") ? (
            <FieldError>{errorOf("category")}</FieldError>
          ) : null}
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">
            {t("regions")}{" "}
            <span className="font-normal text-muted-foreground">
              {t("optional")}
            </span>
          </FieldLegend>
          {regions.map((region) => (
            <input key={region} type="hidden" name="regions" value={region} />
          ))}
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((value) => {
              const on = regions.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setRegions((current) =>
                      on
                        ? current.filter((entry) => entry !== value)
                        : [...current, value],
                    )
                  }
                  className={cn(chip, on ? chipOn : chipOff)}
                >
                  {on ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : null}
                  {tRegions(value)}
                </button>
              );
            })}
          </div>
        </FieldSet>
        <Field data-invalid={errorOf("about") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-about`}>
            {t("about")}{" "}
            <span className="font-normal text-muted-foreground">
              {t("optional")}
            </span>
          </FieldLabel>
          <Textarea
            id={`${id}-about`}
            name="about"
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            maxLength={PAGE_LIMITS.about}
            rows={5}
            placeholder={t("aboutPlaceholder")}
          />
          <FieldDescription>
            {t("aboutCount", {
              count: about.length,
              max: PAGE_LIMITS.about,
            })}
          </FieldDescription>
          {errorOf("about") ? (
            <FieldError>{errorOf("about")}</FieldError>
          ) : null}
        </Field>
        <Field data-invalid={errorOf("website") ? true : undefined}>
          <FieldLabel htmlFor={`${id}-website`}>
            {t("website")}{" "}
            <span className="font-normal text-muted-foreground">
              {t("optional")}
            </span>
          </FieldLabel>
          <Input
            id={`${id}-website`}
            name="website"
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            maxLength={PAGE_LIMITS.website}
            autoComplete="url"
            placeholder="https://"
            className="h-11"
          />
          {errorOf("website") ? (
            <FieldError>{errorOf("website")}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tErrors(state.error as PageError)}
        </p>
      ) : null}
      {state.status === "saved" && mode === "update" ? (
        <p role="status" className="text-sm font-medium text-primary">
          {t("saved")}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full sm:w-fit" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {mode === "create" ? t("create") : t("save")}
      </Button>
    </form>
  );
}
