"use client";

import {
  CalendarPlus,
  Check,
  Flag,
  LoaderCircle,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/features/community/components/report-dialog";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  addToCalendarAction,
  cancelEventAction,
  deleteEventAction,
  setAttendanceAction,
} from "../actions";
import type { CommunityEventError, EventAttendanceStatus } from "../rules";

/**
 * « J'y vais » et « Intéressé » : la réponse s'affiche tout de suite, le
 * serveur confirme (places, annulation). Toucher de nouveau retire la réponse.
 */
export function AttendanceButtons({
  eventId,
  initial,
  full,
}: {
  eventId: string;
  initial: EventAttendanceStatus | null;
  /** Plus de place : « J'y vais » n'est possible que si j'y vais déjà. */
  full: boolean;
}) {
  const t = useTranslations("CommunityEvents");
  const [mine, setMine] = useState(initial);
  const [error, setError] = useState<CommunityEventError | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: EventAttendanceStatus) {
    const value = mine === next ? null : next;
    const before = mine;
    setMine(value);
    setError(null);
    startTransition(async () => {
      const result = await setAttendanceAction(eventId, value);
      if (!result.ok) {
        setMine(before);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          aria-pressed={mine === "going"}
          disabled={pending || (full && mine !== "going")}
          onClick={() => choose("going")}
          variant={mine === "going" ? "default" : "outline"}
          className="h-12 flex-1 rounded-full text-base sm:flex-none sm:px-7"
        >
          <Check aria-hidden="true" />
          {mine === "going" ? t("rsvp.goingOn") : t("rsvp.going")}
        </Button>
        <Button
          size="lg"
          variant="outline"
          aria-pressed={mine === "interested"}
          disabled={pending}
          onClick={() => choose("interested")}
          className={cn(
            "h-12 flex-1 rounded-full text-base sm:flex-none sm:px-6",
            mine === "interested" && "border-primary bg-primary/15",
          )}
        >
          <Star
            aria-hidden="true"
            className={cn(mine === "interested" && "fill-current text-primary")}
          />
          {t("rsvp.interested")}
        </Button>
      </div>
      {mine ? (
        <p className="text-xs text-muted-foreground">{t("rsvp.undoHint")}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}

/** Copier l'événement dans mon calendrier personnel (Mon développement). */
export function CalendarButton({ eventId }: { eventId: string }) {
  const t = useTranslations("CommunityEvents");
  const locale = useLocale();
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState<CommunityEventError | null>(null);
  const [pending, startTransition] = useTransition();

  if (day) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
        <Check aria-hidden="true" className="size-4 text-primary" />
        {t("calendar.added")}
        <Link
          href={{ pathname: "/services", query: { day } }}
          className="font-semibold underline underline-offset-4"
        >
          {t("calendar.see")}
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        disabled={pending}
        className="w-fit px-0 hover:bg-transparent"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await addToCalendarAction(eventId, locale);
            if (result.ok) setDay(result.day ?? null);
            else setError(result.error);
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <CalendarPlus aria-hidden="true" className="text-primary" />
        )}
        {t("calendar.add")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}

/** Partager le lien (partage du téléphone, sinon le lien copié). */
export function ShareEventButton({ title }: { title: string }) {
  const t = useTranslations("CommunityEvents");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="w-fit px-0 hover:bg-transparent"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? (
        <Check aria-hidden="true" className="text-primary" />
      ) : (
        <Share2 aria-hidden="true" className="text-primary" />
      )}
      {copied ? t("share.copied") : t("share.label")}
    </Button>
  );
}

/** Signaler l'événement à la modération. */
export function ReportEventButton({ eventId }: { eventId: string }) {
  const t = useTranslations("CommunityEvents");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={done}
        onClick={() => setOpen(true)}
        className="w-fit text-muted-foreground"
      >
        <Flag aria-hidden="true" />
        {done ? t("reported") : t("report")}
      </Button>
      <ReportDialog
        target={open ? { type: "event", id: eventId } : null}
        onClose={() => setOpen(false)}
        onReported={() => {
          setOpen(false);
          setDone(true);
        }}
      />
    </>
  );
}

/** L'hôte : annuler (les inscrits sont prévenus) ou supprimer l'événement. */
export function HostActions({
  eventId,
  cancelled,
}: {
  eventId: string;
  cancelled: boolean;
}) {
  const t = useTranslations("CommunityEvents.host");
  const tErrors = useTranslations("CommunityEvents.errors");
  const locale = useLocale();
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [error, setError] = useState<CommunityEventError | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result =
        confirm === "delete"
          ? await deleteEventAction(eventId, locale)
          : await cancelEventAction(eventId);
      if (result.ok) setConfirm(null);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {cancelled ? null : (
        <>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/events/${eventId}/edit`}>{t("edit")}</Link>
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-muted-foreground"
            onClick={() => setConfirm("cancel")}
          >
            <X aria-hidden="true" />
            {t("cancel")}
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        className="rounded-full text-destructive hover:text-destructive"
        onClick={() => setConfirm("delete")}
      >
        <Trash2 aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? t("deleteTitle") : t("cancelTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? t("deleteDescription")
                : t("cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {tErrors(error)}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={run}>
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {confirm === "delete" ? t("deleteConfirm") : t("cancelConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
