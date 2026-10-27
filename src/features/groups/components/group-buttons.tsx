"use client";

import {
  Check,
  EllipsisVertical,
  LoaderCircle,
  LogOut,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { GroupRole } from "../rules";
import type { GroupError } from "../rules";
import {
  deleteGroupAction,
  inviteToGroupAction,
  joinGroupAction,
  leaveGroupAction,
  removeGroupMemberAction,
  respondToGroupInviteAction,
  searchInviteesAction,
  setGroupRoleAction,
} from "../actions";

/** Message d'erreur sous un bouton (rôle « alert »). */
function ErrorText({ error }: { error: GroupError | null }) {
  const t = useTranslations("Groups.errors");
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {t(error)}
    </p>
  ) : null;
}

/** Rejoindre un groupe public. */
export function JoinGroupButton({
  groupId,
  size = "default",
}: {
  groupId: string;
  size?: "default" | "sm";
}) {
  const t = useTranslations("Groups");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<GroupError | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        size={size}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinGroupAction(groupId);
            setError(result.ok ? null : result.error);
          })
        }
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <UserPlus aria-hidden="true" />
        )}
        {t("join")}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

/** Accepter ou refuser une invitation à un groupe privé. */
export function InvitationButtons({ groupId }: { groupId: string }) {
  const t = useTranslations("Groups.invitations");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<GroupError | null>(null);
  const respond = (accept: boolean) =>
    startTransition(async () => {
      const result = await respondToGroupInviteAction(groupId, accept);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (accept) router.push(`/groups/${groupId}`);
    });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => respond(true)}>
          <Check aria-hidden="true" />
          {t("accept")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => respond(false)}
        >
          {t("decline")}
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

/** Quitter le groupe (membres et admins). */
export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const t = useTranslations("Groups");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<GroupError | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await leaveGroupAction(groupId);
            if (result.ok) router.push("/groups");
            else setError(result.error);
          })
        }
        className="w-fit text-muted-foreground"
      >
        <LogOut aria-hidden="true" />
        {t("leave")}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

/** Supprimer le groupe (le créateur), après confirmation. */
export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const t = useTranslations("Groups");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<GroupError | null>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-fit text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden="true" />
        {t("delete")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorText error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  // En cas de succès, l'action ouvre les Groupes
                  const result = await deleteGroupAction(groupId, locale);
                  if (!result.ok) setError(result.error);
                })
              }
            >
              {pending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Menu d'un membre : nommer ou retirer un admin (le créateur), retirer du groupe. */
export function MemberMenu({
  groupId,
  userId,
  name,
  role,
  viewerRole,
}: {
  groupId: string;
  userId: string;
  name: string;
  role: GroupRole;
  viewerRole: GroupRole;
}) {
  const t = useTranslations("Groups.memberList");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<GroupError | null>(null);
  const act = (task: () => Promise<{ ok: boolean; error?: GroupError }>) =>
    startTransition(async () => {
      const result = await task();
      setError(result.ok ? null : (result.error ?? "unexpected"));
    });
  const canRemove =
    role !== "owner" && (viewerRole === "owner" || role === "member");
  if (!canRemove) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t("options", { name })}
            className="text-muted-foreground"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <EllipsisVertical aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {viewerRole === "owner" ? (
            <DropdownMenuItem
              onSelect={() =>
                act(() =>
                  setGroupRoleAction(
                    groupId,
                    userId,
                    role === "admin" ? "member" : "admin",
                  ),
                )
              }
            >
              {role === "admin" ? (
                <ShieldOff aria-hidden="true" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              {role === "admin" ? t("removeAdmin") : t("makeAdmin")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => act(() => removeGroupMemberAction(groupId, userId))}
          >
            <UserMinus aria-hidden="true" />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ErrorText error={error} />
    </div>
  );
}

type Invitee = Awaited<ReturnType<typeof searchInviteesAction>>[number];

/** Inviter des membres du Centre dans un groupe privé (le créateur et les admins). */
export function InviteDialog({ groupId }: { groupId: string }) {
  const t = useTranslations("Groups.memberList");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Invitee[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<GroupError | null>(null);
  const [pending, startTransition] = useTransition();

  // Recherche à la frappe, après une courte pause
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const found = await searchInviteesAction(value).catch(() => []);
      if (active) setResults(found);
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        {t("invite")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("close")} className="flex flex-col gap-4">
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor={`${id}-search`} className="sr-only">
              {t("searchLabel")}
            </label>
            <Input
              id={`${id}-search`}
              value={query}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
          {query.trim().length >= 2 && results.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="flex flex-col">
              {(query.trim().length >= 2 ? results : []).map((person) => {
                const name = person.displayName ?? person.username ?? "";
                const done = sent.has(person.id);
                return (
                  <li
                    key={person.id}
                    className="flex items-center gap-3 border-b border-white/8 py-2.5"
                  >
                    <Avatar
                      name={name}
                      url={person.avatarUrl}
                      className="size-9"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        @{person.username ?? ""}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={done ? "ghost" : "secondary"}
                      disabled={done || pending}
                      aria-label={t("inviteAction", { name })}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await inviteToGroupAction(
                            groupId,
                            person.id,
                          );
                          if (result.ok) {
                            setSent((current) =>
                              new Set(current).add(person.id),
                            );
                            setError(null);
                          } else {
                            setError(result.error);
                          }
                        })
                      }
                    >
                      {done ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <UserPlus aria-hidden="true" />
                      )}
                      {done ? t("sent") : t("invite")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <ErrorText error={error} />
        </DialogContent>
      </Dialog>
    </>
  );
}
