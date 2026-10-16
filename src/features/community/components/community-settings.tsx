import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCommunityMember,
  listBlockedUsers,
} from "@/server/community/members";
import { getCurrentProfile } from "@/server/profile/service";
import { UnblockButton } from "./unblock-button";

/** Le Centre Get iT dans les Réglages : nom d'utilisateur et personnes bloquées. */
export async function CommunitySettings() {
  const profile = await getCurrentProfile();
  const [t, member, blocked] = await Promise.all([
    getTranslations("Community.settings"),
    getCommunityMember(profile.id),
    listBlockedUsers(profile.id),
  ]);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          {member?.joined
            ? t("username", { username: member.username ?? "" })
            : t("notJoined")}
        </p>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("blockedTitle")}</h3>
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("blockedEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {blocked.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="min-w-0 text-sm break-words">
                    {person.displayName}{" "}
                    <span className="text-muted-foreground">
                      @{person.username}
                    </span>
                  </span>
                  <UnblockButton userId={person.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CommunitySettingsSkeleton() {
  return <Skeleton className="h-40 max-w-2xl rounded-3xl" />;
}
