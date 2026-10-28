"use client";

import { Camera, LoaderCircle, PenLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition, type ChangeEvent } from "react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  MediaError,
  prepareAvatar,
  uploadFile,
} from "@/features/community/media-client";
import {
  COMMUNITY_ERRORS,
  type CommunityError,
} from "@/features/community/rules";
import {
  removeAvatarAction,
  requestAvatarUploadAction,
  setAvatarAction,
  setBioAction,
} from "../actions";
import { BIO_MAX_LENGTH } from "../rules";

type ProfileEditorProps = {
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Stockage configuré : sinon, pas de photo. */
  photosEnabled: boolean;
};

const asError = (code: string): CommunityError =>
  COMMUNITY_ERRORS.find((item) => item === code) ?? "unexpected";

/** « Modifier le profil » : photo (carrée) et courte présentation. */
export function ProfileEditor({
  name,
  avatarUrl,
  bio,
  photosEnabled,
}: ProfileEditorProps) {
  const t = useTranslations("App.profile.editor");
  const tErrors = useTranslations("Community.errors");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(bio ?? "");
  const [error, setError] = useState<CommunityError | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const image = await prepareAvatar(file);
      const slots = await requestAvatarUploadAction([
        { mimeType: image.blob.type, size: image.blob.size },
      ]);
      if (!slots.ok) {
        setError(asError(slots.error));
        return;
      }
      const slot = slots.slots[0];
      if (!slot) throw new Error("aucune autorisation");
      await uploadFile(slot.url, image.blob, () => undefined);
      const result = await setAvatarAction({
        uploadId: slot.uploadId,
        width: image.width,
        height: image.height,
      });
      if (!result.ok) setError(asError(result.error));
    } catch (caught) {
      setError(
        caught instanceof MediaError ? asError(caught.code) : "unexpected",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PenLine aria-hidden="true" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("close")} className="flex flex-col gap-5">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>

          <div className="flex items-center gap-4">
            <span className="relative">
              <Avatar
                name={name}
                url={avatarUrl}
                className="size-20 text-2xl"
              />
              {uploading ? (
                <span className="dark absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                  <LoaderCircle
                    aria-label={t("uploading")}
                    className="size-5 animate-spin"
                  />
                </span>
              ) : null}
            </span>
            {photosEnabled ? (
              <div className="flex flex-col gap-2">
                <label className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3.5 text-sm font-medium transition-colors hover:bg-foreground/[0.06] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={choose}
                    className="sr-only"
                  />
                  <Camera aria-hidden="true" className="size-4 text-primary" />
                  {avatarUrl ? t("change") : t("add")}
                </label>
                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={uploading || pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeAvatarAction();
                      })
                    }
                    className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t("remove")}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("photosUnavailable")}
              </p>
            )}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-bio`} className="text-sm font-medium">
              {t("bio")}
            </label>
            <Textarea
              id={`${id}-bio`}
              value={text}
              maxLength={BIO_MAX_LENGTH}
              rows={3}
              placeholder={t("bioPlaceholder")}
              onChange={(event) => {
                setText(event.target.value);
                setSaved(false);
              }}
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {text.length}/{BIO_MAX_LENGTH}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setSaved(await setBioAction(text));
                })
              }
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("save")}
            </Button>
            {saved ? (
              <p role="status" className="text-sm text-primary">
                {t("saved")}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
