"use client";

import {
  HeartHandshake,
  LoaderCircle,
  MessageCircle,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  acceptInvitationAction,
  addClientNoteAction,
  cancelInvitationAction,
  declineInvitationAction,
  deleteClientNoteAction,
  endClientAction,
  inviteClientAction,
  leaveProAction,
  requestClientAction,
  respondClientRequestAction,
  updateSharesAction,
  writeToClientAction,
} from "../actions";
import {
  CLIENT_LIMITS,
  SHAREABLE_KINDS,
  type ClientError,
  type ShareableKind,
} from "../rules";

type SharesValue = { kinds: ShareableKind[]; mentalConsent: boolean };

/**
 * Ce que la page verra, plan par plan. Le plan mental demande une case
 * d'accord à part ; ce que la page ne voit jamais est rappelé.
 */
function SharesPicker({
  page,
  planKinds,
  value,
  onChange,
}: {
  page: string;
  /** Mes plans existants (les autres : « pas encore de plan »). */
  planKinds: readonly ShareableKind[];
  value: SharesValue;
  onChange: (value: SharesValue) => void;
}) {
  const t = useTranslations("Clients.shares");
  const tKinds = useTranslations("Development.kinds");
  const id = useId();
  const toggle = (kind: ShareableKind, on: boolean) => {
    const kinds = on
      ? [...value.kinds, kind]
      : value.kinds.filter((entry) => entry !== kind);
    onChange({
      kinds,
      mentalConsent: kinds.includes("mental") ? value.mentalConsent : false,
    });
  };
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-semibold">{t("title", { page })}</legend>
      <p className="mb-2 text-sm text-pretty text-muted-foreground">
        {t("hint")}
      </p>
      {SHAREABLE_KINDS.map((kind) => {
        const checked = value.kinds.includes(kind);
        return (
          <div key={kind} className="flex flex-col">
            <label
              htmlFor={`${id}-${kind}`}
              className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-foreground/8"
            >
              <Checkbox
                id={`${id}-${kind}`}
                checked={checked}
                onCheckedChange={(state) => toggle(kind, state === true)}
              />
              <span className="flex-1 text-sm font-medium">
                {tKinds(`${kind}.title`)}
              </span>
              {planKinds.includes(kind) ? null : (
                <span className="text-xs text-muted-foreground">
                  {t("noPlan")}
                </span>
              )}
            </label>
            {/* Le plan mental : un accord explicite, à part (Loi 25) */}
            {kind === "mental" && checked ? (
              <label
                htmlFor={`${id}-consent`}
                className="flex cursor-pointer items-start gap-3 rounded-xl bg-primary/8 p-3 text-sm"
              >
                <Checkbox
                  id={`${id}-consent`}
                  checked={value.mentalConsent}
                  onCheckedChange={(state) =>
                    onChange({ ...value, mentalConsent: state === true })
                  }
                  className="mt-0.5"
                />
                <span className="text-pretty">
                  {t("mentalConsent", { page })}
                </span>
              </label>
            ) : null}
          </div>
        );
      })}
      <p className="mt-2 text-xs text-pretty text-muted-foreground">
        {t("never", { page })}
      </p>
      <p className="text-xs text-pretty text-muted-foreground">{t("notes")}</p>
    </fieldset>
  );
}

function ErrorLine({ error }: { error: ClientError | null }) {
  const t = useTranslations("Clients.errors");
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {t(error)}
    </p>
  ) : null;
}

const Spinner = ({ on }: { on: boolean }) =>
  on ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null;

/** Sur la page publique d'un pro : demander à devenir son client. */
export function RequestClientButton({
  pageId,
  pageName,
  planKinds,
}: {
  pageId: string;
  pageName: string;
  planKinds: ShareableKind[];
}) {
  const t = useTranslations("Clients.request");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<SharesValue>({
    kinds: [],
    mentalConsent: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ClientError | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="lg"
        variant="outline"
        onClick={() => setOpen(true)}
        className="identity-personal"
      >
        <HeartHandshake aria-hidden="true" />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel={t("close")}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        >
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>{t("title", { page: pageName })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
          <SharesPicker
            page={pageName}
            planKinds={planKinds}
            value={shares}
            onChange={setShares}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-message`} className="text-sm font-medium">
              {t("message", { page: pageName })}
            </label>
            <Textarea
              id={`${id}-message`}
              value={message}
              maxLength={CLIENT_LIMITS.message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <ErrorLine error={error} />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await requestClientAction({
                  pageId,
                  shares,
                  message,
                }).catch(() => ({
                  ok: false as const,
                  error: "unexpected" as const,
                }));
                if (result.ok) setOpen(false);
                else setError(result.error);
              })
            }
          >
            <Spinner on={pending} />
            {t("send")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Choisir ce que la page voit : pour accepter une invitation, ou le changer. */
export function SharesDialogButton({
  relationId,
  pageName,
  planKinds,
  initial,
  mode,
}: {
  relationId: string;
  pageName: string;
  planKinds: ShareableKind[];
  initial: SharesValue;
  mode: "accept" | "edit";
}) {
  const t = useTranslations("Clients");
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<SharesValue>(initial);
  const [error, setError] = useState<ClientError | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant={mode === "accept" ? "default" : "outline"}
        className="h-11"
        onClick={() => {
          setShares(initial);
          setError(null);
          setOpen(true);
        }}
      >
        {mode === "accept" ? t("invitation.accept") : t("shares.edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel={t("request.close")}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        >
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>
              {mode === "accept"
                ? t("invitation.acceptTitle", { page: pageName })
                : t("shares.editTitle", { page: pageName })}
            </DialogTitle>
          </div>
          <SharesPicker
            page={pageName}
            planKinds={planKinds}
            value={shares}
            onChange={setShares}
          />
          <ErrorLine error={error} />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await (
                  mode === "accept"
                    ? acceptInvitationAction(relationId, shares)
                    : updateSharesAction(relationId, shares)
                ).catch(() => ({
                  ok: false as const,
                  error: "unexpected" as const,
                }));
                if (result.ok) setOpen(false);
                else setError(result.error);
              })
            }
          >
            <Spinner on={pending} />
            {mode === "accept" ? t("invitation.confirm") : t("shares.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Une confirmation, puis l'action (fin d'un suivi, refus, retrait). */
function ConfirmButton({
  label,
  title,
  description,
  confirm,
  onConfirm,
  destructive = true,
}: {
  label: string;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => Promise<boolean>;
  destructive?: boolean;
}) {
  const t = useTranslations("Clients");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          "h-11",
          destructive && "text-destructive hover:text-destructive",
        )}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("errors.unexpected")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const ok = await onConfirm().catch(() => false);
                  if (ok) setOpen(false);
                  else setFailed(true);
                })
              }
            >
              <Spinner on={pending} />
              {confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Refuser une invitation (la page n'est pas prévenue). */
export function DeclineInvitationButton({
  relationId,
  pageName,
}: {
  relationId: string;
  pageName: string;
}) {
  const t = useTranslations("Clients.invitation");
  return (
    <ConfirmButton
      label={t("decline")}
      title={t("declineTitle", { page: pageName })}
      description={t("declineDescription")}
      confirm={t("decline")}
      onConfirm={() => declineInvitationAction(relationId)}
    />
  );
}

/** Mettre fin au suivi d'un pro, ou retirer sa demande. */
export function LeaveProButton({
  relationId,
  pageName,
  requested,
}: {
  relationId: string;
  pageName: string;
  requested: boolean;
}) {
  const t = useTranslations("Clients.leave");
  return requested ? (
    <ConfirmButton
      label={t("cancelRequest")}
      title={t("cancelTitle", { page: pageName })}
      description={t("cancelDescription")}
      confirm={t("cancelRequest")}
      onConfirm={() => leaveProAction(relationId)}
    />
  ) : (
    <ConfirmButton
      label={t("button")}
      title={t("title", { page: pageName })}
      description={t("description", { page: pageName })}
      confirm={t("confirm")}
      onConfirm={() => leaveProAction(relationId)}
    />
  );
}

/** Sur sa page : inviter un membre du Centre à devenir client. */
export function InviteClientButton() {
  const t = useTranslations("Clients.invite");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ClientError | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        className="h-11"
        onClick={() => {
          setError(null);
          setSent(null);
          setOpen(true);
        }}
      >
        <UserPlus aria-hidden="true" />
        {t("button")}
      </Button>
      {sent ? (
        <p role="status" className="text-sm text-primary">
          {t("sent", { username: sent })}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("close")} className="sm:max-w-md">
          <div className="flex flex-col gap-1 pr-8">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                setError(null);
                const result = await inviteClientAction({
                  username,
                  message,
                }).catch(() => ({
                  ok: false as const,
                  error: "unexpected" as const,
                }));
                if (result.ok) {
                  setSent(username.replace(/^@/, ""));
                  setUsername("");
                  setMessage("");
                  setOpen(false);
                } else setError(result.error);
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-username`} className="text-sm font-medium">
                {t("username")}
              </label>
              <Input
                id={`${id}-username`}
                value={username}
                autoComplete="off"
                autoCapitalize="none"
                placeholder={t("placeholder")}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-message`} className="text-sm font-medium">
                {t("message")}
              </label>
              <Textarea
                id={`${id}-message`}
                value={message}
                maxLength={CLIENT_LIMITS.message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
            <ErrorLine error={error} />
            <Button type="submit" disabled={pending || !username.trim()}>
              <Spinner on={pending} />
              {t("send")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Accepter ou refuser la demande d'un membre. */
export function RequestAnswerButtons({ relationId }: { relationId: string }) {
  const t = useTranslations("Clients.answer");
  const [error, setError] = useState<ClientError | null>(null);
  const [pending, startTransition] = useTransition();
  const answer = (accept: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await respondClientRequestAction(relationId, accept).catch(
        () => ({ ok: false as const, error: "unexpected" as const }),
      );
      if (!result.ok) setError(result.error);
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11"
          disabled={pending}
          onClick={() => answer(true)}
        >
          <Spinner on={pending} />
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => answer(false)}
        >
          {t("decline")}
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

export function CancelInvitationButton({ relationId }: { relationId: string }) {
  const t = useTranslations("Clients");
  return (
    <ConfirmButton
      label={t("cancelInvite")}
      title={t("cancelInviteTitle")}
      description={t("cancelInviteDescription")}
      confirm={t("cancelInvite")}
      onConfirm={() => cancelInvitationAction(relationId)}
    />
  );
}

/** La page met fin au suivi : elle ne voit plus ses plans, ses notes restent. */
export function EndClientButton({
  relationId,
  name,
}: {
  relationId: string;
  name: string;
}) {
  const t = useTranslations("Clients.end");
  return (
    <ConfirmButton
      label={t("button")}
      title={t("title", { name })}
      description={t("description")}
      confirm={t("confirm")}
      onConfirm={() => endClientAction(relationId)}
    />
  );
}

/** Écrire à un client : la conversation de la page avec lui. */
export function WriteToClientButton({ clientId }: { clientId: string }) {
  const t = useTranslations("Clients");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        className="h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setFailed(false);
            const result = await writeToClientAction(clientId).catch(() => ({
              ok: false as const,
            }));
            if (result.ok) router.push(`/messages/${result.id}`);
            else setFailed(true);
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <MessageCircle aria-hidden="true" />
        )}
        {t("write")}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("errors.unexpected")}
        </p>
      ) : null}
    </div>
  );
}

/** Ajouter une note privée sur un client. */
export function NoteComposer({ clientId }: { clientId: string }) {
  const t = useTranslations("Clients.notes");
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<ClientError | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await addClientNoteAction(clientId, body).catch(
            () => ({ ok: false as const, error: "unexpected" as const }),
          );
          if (result.ok) setBody("");
          else setError(result.error);
        });
      }}
    >
      <label htmlFor={`${id}-note`} className="sr-only">
        {t("label")}
      </label>
      <Textarea
        id={`${id}-note`}
        value={body}
        maxLength={CLIENT_LIMITS.note}
        placeholder={t("placeholder")}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-24"
      />
      <ErrorLine error={error} />
      <Button
        type="submit"
        variant="outline"
        className="h-11 w-fit"
        disabled={pending || !body.trim()}
      >
        <Spinner on={pending} />
        {t("add")}
      </Button>
    </form>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  const t = useTranslations("Clients.notes");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("delete")}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteClientNoteAction(noteId);
        })
      }
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );
}
