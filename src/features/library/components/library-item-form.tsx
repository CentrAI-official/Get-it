"use client";

import {
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  Trash2,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  prepareImage,
  prepareVideo,
  uploadFile,
} from "@/features/community/media-client";
import type { MediaMimeType } from "@/features/community/media";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { getLibraryItemForEdit } from "@/server/library/service";
import {
  deleteLibraryItemAction,
  requestLibraryUploadAction,
  saveLibraryItemAction,
} from "../actions";
import {
  FILTER_GROUPS,
  LIBRARY_LIMITS,
  TOOL_PILLARS,
  TOOL_THEMES,
  libraryItemSchema,
  tagOf,
  type LibraryContent,
  type LibraryKind,
  type ToolPillar,
} from "../rules";

type Initial = NonNullable<Awaited<ReturnType<typeof getLibraryItemForEdit>>>;

/** Textes d'une langue dans le formulaire : les listes en une ligne par élément. */
type Texts = {
  title: string;
  summary: string;
  description: string;
  steps: string;
  cues: string;
  mistakes: string;
  ingredients: string;
};

const EMPTY: Texts = {
  title: "",
  summary: "",
  description: "",
  steps: "",
  cues: "",
  mistakes: "",
  ingredients: "",
};

const toTexts = (content: LibraryContent | null): Texts =>
  content
    ? {
        title: content.title,
        summary: content.summary,
        description: content.description,
        steps: content.steps.join("\n"),
        cues: content.cues.join("\n"),
        mistakes: content.mistakes.join("\n"),
        ingredients: content.ingredients.join("\n"),
      }
    : EMPTY;

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const toContent = (texts: Texts) => ({
  title: texts.title.trim(),
  summary: texts.summary.trim(),
  description: texts.description.trim(),
  steps: lines(texts.steps),
  cues: lines(texts.cues),
  mistakes: lines(texts.mistakes),
  ingredients: lines(texts.ingredients),
});

/** Média : déjà enregistré (lien), nouvellement envoyé (chemin) ou retiré. */
type Media = { url: string | null; path: string | null | undefined };

type FormError = "invalid" | "fileInvalid" | "uploadFailed" | "unexpected";

/**
 * Formulaire d'une fiche du catalogue (équipe Get iT). Les listes s'écrivent
 * une ligne par élément ; l'anglais est facultatif. Les fichiers partent
 * directement au stockage, puis le serveur les revérifie.
 */
export function LibraryItemForm({
  kind,
  initial,
}: {
  kind: LibraryKind;
  initial: Initial | null;
}) {
  const t = useTranslations("LibraryAdmin.form");
  const tValues = useTranslations("Library.values");
  const tFilters = useTranslations("Library.filters");
  const id = useId();
  const router = useRouter();
  const [pillar, setPillar] = useState<ToolPillar>(
    initial?.pillar === "social" ? "social" : "mental",
  );
  const [fr, setFr] = useState<Texts>(toTexts(initial?.content.fr ?? null));
  const [en, setEn] = useState<Texts>(toTexts(initial?.content.en ?? null));
  const [withEnglish, setWithEnglish] = useState(Boolean(initial?.content.en));
  const [minutes, setMinutes] = useState(initial?.minutes?.toString() ?? "");
  const [servings, setServings] = useState(initial?.servings?.toString() ?? "");
  const [tags, setTags] = useState<Set<string>>(new Set(initial?.tags ?? []));
  const [published, setPublished] = useState(initial?.status === "published");
  const [image, setImage] = useState<Media>({
    url: initial?.imageUrl ?? null,
    path: undefined,
  });
  const [video, setVideo] = useState<Media>({
    url: initial?.videoUrl ?? null,
    path: undefined,
  });
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<FormError | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  // Familles d'étiquettes de ce type ; les allergènes d'une recette sont ceux qu'elle contient
  const groups: [string, readonly string[]][] =
    kind === "tool"
      ? [["theme", TOOL_THEMES[pillar]]]
      : Object.entries(FILTER_GROUPS[kind]);

  function toggle(tag: string) {
    setTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function upload(media: "image" | "video", file: File) {
    setError(null);
    setUploading(media);
    setProgress(0);
    try {
      const prepared =
        media === "image"
          ? { blob: (await prepareImage(file)).blob }
          : { blob: (await prepareVideo(file)).file as Blob };
      const contentType = (prepared.blob.type ||
        (media === "image" ? "image/jpeg" : "video/mp4")) as MediaMimeType;
      const ticket = await requestLibraryUploadAction({ media, contentType });
      if (!ticket) throw new Error("upload");
      await uploadFile(ticket.url, prepared.blob, setProgress);
      const preview = URL.createObjectURL(prepared.blob);
      (media === "image" ? setImage : setVideo)({
        url: preview,
        path: ticket.path,
      });
    } catch {
      setError("uploadFailed");
    } finally {
      setUploading(null);
    }
  }

  function save() {
    setError(null);
    setSaved(false);
    const parsed = libraryItemSchema.safeParse({
      kind,
      pillar: kind === "tool" ? pillar : null,
      content: {
        fr: toContent(fr),
        en: withEnglish && en.title.trim() ? toContent(en) : null,
      },
      // Un outil garde seulement les thèmes de son pilier
      tags: [...tags].filter((tag) =>
        groups.some(([group, values]) =>
          values.some((value) => tagOf(group, value) === tag),
        ),
      ),
      minutes: minutes.trim() ? Number(minutes) : null,
      servings: kind === "recipe" && servings.trim() ? Number(servings) : null,
    });
    if (!parsed.success) {
      setError("invalid");
      return;
    }
    startTransition(async () => {
      const result = await saveLibraryItemAction({
        id: initial?.id ?? null,
        item: parsed.data,
        status: published ? "published" : "draft",
        ...(image.path !== undefined ? { imagePath: image.path } : {}),
        ...(video.path !== undefined ? { videoPath: video.path } : {}),
      });
      if (!result.ok) {
        setError(result.error === "fileInvalid" ? "fileInvalid" : "invalid");
        return;
      }
      setSaved(true);
      if (!initial) router.replace(`/settings/library/${result.id}`);
    });
  }

  const textFields = (
    texts: Texts,
    set: (next: Texts) => void,
    lang: string,
  ) => (
    <div className="flex flex-col gap-5">
      <Field id={`${id}-${lang}-title`} label={t("title")}>
        <Input
          id={`${id}-${lang}-title`}
          name={`${lang}-title`}
          value={texts.title}
          maxLength={LIBRARY_LIMITS.title}
          onChange={(event) => set({ ...texts, title: event.target.value })}
        />
      </Field>
      <Field id={`${id}-${lang}-summary`} label={t("summary")}>
        <Input
          id={`${id}-${lang}-summary`}
          name={`${lang}-summary`}
          value={texts.summary}
          maxLength={LIBRARY_LIMITS.summary}
          onChange={(event) => set({ ...texts, summary: event.target.value })}
        />
      </Field>
      <Field id={`${id}-${lang}-description`} label={t("description")}>
        <Textarea
          id={`${id}-${lang}-description`}
          name={`${lang}-description`}
          value={texts.description}
          maxLength={LIBRARY_LIMITS.description}
          rows={3}
          onChange={(event) =>
            set({ ...texts, description: event.target.value })
          }
        />
      </Field>
      {kind === "recipe" ? (
        <Field
          id={`${id}-${lang}-ingredients`}
          label={t("ingredients")}
          hint={t("oneLine")}
        >
          <Textarea
            id={`${id}-${lang}-ingredients`}
            name={`${lang}-ingredients`}
            value={texts.ingredients}
            rows={6}
            onChange={(event) =>
              set({ ...texts, ingredients: event.target.value })
            }
          />
        </Field>
      ) : null}
      <Field
        id={`${id}-${lang}-steps`}
        label={t(`steps.${kind}`)}
        hint={t("oneLine")}
      >
        <Textarea
          id={`${id}-${lang}-steps`}
          name={`${lang}-steps`}
          value={texts.steps}
          rows={6}
          onChange={(event) => set({ ...texts, steps: event.target.value })}
        />
      </Field>
      {kind === "exercise" ? (
        <>
          <Field
            id={`${id}-${lang}-cues`}
            label={t("cues")}
            hint={t("oneLine")}
          >
            <Textarea
              id={`${id}-${lang}-cues`}
              name={`${lang}-cues`}
              value={texts.cues}
              rows={4}
              onChange={(event) => set({ ...texts, cues: event.target.value })}
            />
          </Field>
          <Field
            id={`${id}-${lang}-mistakes`}
            label={t("mistakes")}
            hint={t("oneLine")}
          >
            <Textarea
              id={`${id}-${lang}-mistakes`}
              name={`${lang}-mistakes`}
              value={texts.mistakes}
              rows={3}
              onChange={(event) =>
                set({ ...texts, mistakes: event.target.value })
              }
            />
          </Field>
        </>
      ) : null}
    </div>
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {kind === "tool" ? (
        <Field id={`${id}-pillar`} label={t("pillar")} group>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-pillar-label`}
            className="flex gap-2"
          >
            {TOOL_PILLARS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={pillar === value}
                onClick={() => setPillar(value)}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  pillar === value
                    ? "border-primary bg-primary/15"
                    : "border-foreground/10 text-muted-foreground",
                )}
              >
                {t(`pillars.${value}`)}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <Section title={t("french")}>{textFields(fr, setFr, "fr")}</Section>

      <Section title={t("english")}>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox
            checked={withEnglish}
            onCheckedChange={(checked) => setWithEnglish(checked === true)}
          />
          {t("withEnglish")}
        </label>
        {withEnglish ? textFields(en, setEn, "en") : null}
      </Section>

      <Section title={t("details")}>
        <div className="flex flex-wrap gap-4">
          <Field
            id={`${id}-minutes`}
            label={t(kind === "recipe" ? "prep" : "minutes")}
          >
            <Input
              id={`${id}-minutes`}
              name="minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={LIBRARY_LIMITS.minutes}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className="w-32"
            />
          </Field>
          {kind === "recipe" ? (
            <Field id={`${id}-servings`} label={t("servings")}>
              <Input
                id={`${id}-servings`}
                name="servings"
                type="number"
                inputMode="numeric"
                min={1}
                max={LIBRARY_LIMITS.servings}
                value={servings}
                onChange={(event) => setServings(event.target.value)}
                className="w-32"
              />
            </Field>
          ) : null}
        </div>
        {groups.map(([group, values]) => (
          <fieldset key={group} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {group === "allergen"
                ? t("contains")
                : tFilters(group as "muscle")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const tag = tagOf(group, value);
                const on = tags.has(tag);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(tag)}
                    className={cn(
                      "h-8 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on
                        ? "border-primary bg-primary/15"
                        : "border-foreground/10 text-muted-foreground",
                    )}
                  >
                    {tValues(`${group}.${value}` as "muscle.chest")}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </Section>

      <Section title={t("media")}>
        <div className="flex flex-wrap gap-4">
          <MediaSlot
            label={t("image")}
            icon={<ImageIcon aria-hidden="true" className="size-6" />}
            preview={
              image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null
            }
            busy={uploading === "image"}
            progress={progress}
            onChoose={() => imageInput.current?.click()}
            onRemove={
              image.url ? () => setImage({ url: null, path: null }) : undefined
            }
            chooseLabel={t("choose")}
            removeLabel={t("remove")}
          />
          {kind === "exercise" ? (
            <MediaSlot
              label={t("video")}
              icon={<Video aria-hidden="true" className="size-6" />}
              preview={
                video.url ? (
                  <video
                    src={video.url}
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                ) : null
              }
              busy={uploading === "video"}
              progress={progress}
              onChoose={() => videoInput.current?.click()}
              onRemove={
                video.url
                  ? () => setVideo({ url: null, path: null })
                  : undefined
              }
              chooseLabel={t("choose")}
              removeLabel={t("remove")}
            />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {kind === "exercise" ? t("mediaHintExercise") : t("mediaHint")}
        </p>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload("image", file);
            event.target.value = "";
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload("video", file);
            event.target.value = "";
          }}
        />
      </Section>

      <section className="flex flex-col gap-4 border-t border-foreground/8 pt-6">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={published}
            onCheckedChange={(checked) => setPublished(checked === true)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("publish")}</span>
            <span className="text-muted-foreground">{t("publishHint")}</span>
          </span>
        </label>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm font-medium text-primary">
            {t("saved")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || uploading !== null}>
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            {t("save")}
          </Button>
          {initial ? <DeleteItem id={initial.id} /> : null}
        </div>
      </section>
    </form>
  );
}

function DeleteItem({ id }: { id: string }) {
  const t = useTranslations("LibraryAdmin.form.delete");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="text-muted-foreground">
          <Trash2 aria-hidden="true" />
          {t("open")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                if (await deleteLibraryItemAction(id)) {
                  router.replace("/settings/library");
                }
              });
            }}
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MediaSlot({
  label,
  icon,
  preview,
  busy,
  progress,
  onChoose,
  onRemove,
  chooseLabel,
  removeLabel,
}: {
  label: string;
  icon: ReactNode;
  preview: ReactNode;
  busy: boolean;
  progress: number;
  onChoose: () => void;
  onRemove?: () => void;
  chooseLabel: string;
  removeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex size-36 items-center justify-center overflow-hidden rounded-2xl bg-foreground/[0.06] text-muted-foreground">
        {busy ? (
          <span className="text-sm tabular-nums">
            {Math.round(progress * 100)} %
          </span>
        ) : (
          (preview ?? icon)
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onChoose}
        >
          {chooseLabel}
        </Button>
        {onRemove ? (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            {removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-foreground/8 pt-6">
      <h2 className="caps-label text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  group = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  group?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {group ? (
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
      ) : (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
