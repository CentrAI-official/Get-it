"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PILLARS, type Pillar } from "@/config/pillars";
import { uploadFile } from "@/features/community/media-client";
import { cn } from "@/lib/utils";
import {
  createMusicTrackAction,
  requestMusicUploadAction,
  setTrackActiveAction,
} from "../music-actions";
import {
  MUSIC_ARTIST_MAX,
  MUSIC_LICENSE_MAX,
  MUSIC_MAX_BYTES,
  MUSIC_MAX_MS,
  MUSIC_MIN_MS,
  MUSIC_TITLE_MAX,
  MUSIC_TYPES,
  type MusicType,
} from "../music";

type Failure =
  | "fileType"
  | "fileSize"
  | "fileDuration"
  | "uploadFailed"
  | "invalid"
  | "unexpected";

/** Type du fichier : celui du navigateur, sinon d'après l'extension (« .m4a » n'a pas toujours de type). */
function musicTypeOf(file: File): MusicType | null {
  if (file.type in MUSIC_TYPES) return file.type as MusicType;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const found = (Object.keys(MUSIC_TYPES) as MusicType[]).find(
    (type) => MUSIC_TYPES[type] === extension,
  );
  return found ?? null;
}

/** Durée d'un fichier audio, lue par le navigateur (en millisecondes). */
function readDuration(file: Blob) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(
        Number.isFinite(audio.duration)
          ? Math.round(audio.duration * 1000)
          : null,
      );
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

/**
 * Ajout d'un morceau libre de droits : le fichier part directement au stockage
 * privé (autorisation à usage unique), puis le serveur le revérifie.
 */
export function MusicUploadForm() {
  const t = useTranslations("MusicCatalog.form");
  const tPillars = useTranslations("Pillars");
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    setFailure(null);
    setDone(false);
    startTransition(async () => {
      if (!file) return;
      const contentType = musicTypeOf(file);
      if (!contentType) return setFailure("fileType");
      if (file.size > MUSIC_MAX_BYTES) return setFailure("fileSize");
      // Même type que celui annoncé : le serveur le revérifie après l'envoi
      const blob = new Blob([file], { type: contentType });
      const durationMs = await readDuration(blob);
      if (
        !durationMs ||
        durationMs < MUSIC_MIN_MS ||
        durationMs > MUSIC_MAX_MS
      ) {
        return setFailure("fileDuration");
      }
      const upload = await requestMusicUploadAction({
        contentType,
        sizeBytes: blob.size,
      });
      if (!upload) return setFailure("uploadFailed");
      try {
        setProgress(0);
        await uploadFile(upload.url, blob, setProgress);
      } catch {
        setProgress(null);
        return setFailure("uploadFailed");
      }
      setProgress(null);
      const result = await createMusicTrackAction({
        title: form.get("title"),
        artist: form.get("artist"),
        moods: form.get("moods") ?? "",
        pillars,
        license: form.get("license"),
        upload: { path: upload.path, durationMs },
      });
      if (!result.ok) {
        return setFailure(
          result.error === "invalid"
            ? "invalid"
            : result.error === "fileInvalid"
              ? "fileType"
              : "unexpected",
        );
      }
      formRef.current?.reset();
      setFile(null);
      setPillars([]);
      setDone(true);
    });
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-file`} className="text-sm font-medium">
          {t("file")}
        </label>
        <input
          id={`${id}-file`}
          type="file"
          required
          accept={[
            ...Object.keys(MUSIC_TYPES),
            ".mp3",
            ".m4a",
            ".aac",
            ".wav",
          ].join(",")}
          onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-foreground/10 file:px-4 file:text-sm file:font-medium file:text-foreground"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-title`} className="text-sm font-medium">
            {t("title")}
          </label>
          <Input
            id={`${id}-title`}
            name="title"
            required
            maxLength={MUSIC_TITLE_MAX}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-artist`} className="text-sm font-medium">
            {t("artist")}
          </label>
          <Input
            id={`${id}-artist`}
            name="artist"
            required
            maxLength={MUSIC_ARTIST_MAX}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-moods`} className="text-sm font-medium">
          {t("moods")}
        </label>
        <Input
          id={`${id}-moods`}
          name="moods"
          maxLength={400}
          placeholder={t("moodsPlaceholder")}
        />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t("pillars")}</legend>
        <div className="flex flex-wrap gap-2">
          {PILLARS.map((pillar) => {
            const checked = pillars.includes(pillar);
            return (
              <button
                key={pillar}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  setPillars((current) =>
                    checked
                      ? current.filter((item) => item !== pillar)
                      : [...current, pillar],
                  )
                }
                className={cn(
                  "h-9 rounded-full border px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  checked
                    ? "border-primary bg-primary/15 font-semibold"
                    : "border-foreground/15 hover:bg-foreground/5",
                )}
              >
                {tPillars(`${pillar}.name`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("pillarsHint")}</p>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-license`} className="text-sm font-medium">
          {t("license")}
        </label>
        <Input
          id={`${id}-license`}
          name="license"
          required
          maxLength={MUSIC_LICENSE_MAX}
          placeholder={t("licensePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("licenseHint")}</p>
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${failure}`)}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("added")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !file} className="w-fit">
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        {progress !== null
          ? t("uploading", { percent: Math.round(progress * 100) })
          : t("submit")}
      </Button>
    </form>
  );
}

/** Retirer un morceau (il disparaît du studio, les stories déjà publiées le gardent) ou le remettre. */
export function TrackToggle({
  trackId,
  active,
  title,
}: {
  trackId: string;
  active: boolean;
  title: string;
}) {
  const t = useTranslations("MusicCatalog");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={active ? "outline" : "default"}
        size="sm"
        disabled={pending}
        aria-label={
          active ? t("removeLabel", { title }) : t("restoreLabel", { title })
        }
        onClick={() =>
          startTransition(async () => {
            setFailed(!(await setTrackActiveAction(trackId, !active)));
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : null}
        {active ? t("remove") : t("restore")}
      </Button>
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          {t("toggleFailed")}
        </p>
      ) : null}
    </div>
  );
}
