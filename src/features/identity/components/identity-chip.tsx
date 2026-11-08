import { getTranslations } from "next-intl/server";
import { PageLogo } from "@/features/pages/components/page-logo";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getActingPage, isStaleIdentity } from "@/server/pages/identity";
import { avatarUrls } from "@/server/profile/avatar";
import { ClearStaleIdentity } from "./identity-switch";

/**
 * Sur sa page : son logo et son nom dans la barre du haut, pour toujours savoir
 * sous quel nom on agit. Lit la session : à placer dans un <Suspense>.
 */
export async function IdentityChip() {
  const user = await getSessionUser();
  if (!user) return null;
  const page = await getActingPage(user.id);
  if (!page) {
    return (await isStaleIdentity(user.id)) ? <ClearStaleIdentity /> : null;
  }
  const [urls, t] = await Promise.all([
    avatarUrls([page.logoPath]),
    getTranslations("Identity"),
  ]);
  return (
    <Link
      href="/pro"
      aria-label={t("chipLabel", { page: page.name })}
      className="flex h-9 min-w-0 items-center gap-2 rounded-full bg-primary/12 py-1 pr-3 pl-1 text-sm font-semibold outline-none hover:bg-primary/18 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <PageLogo
        name={page.name}
        url={page.logoPath ? (urls.get(page.logoPath) ?? null) : null}
        className="size-7 text-sm"
      />
      <span className="max-w-[7.5rem] truncate">{page.name}</span>
    </Link>
  );
}
