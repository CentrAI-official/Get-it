import { ArrowLeftRight, ChevronRight, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { countPageUnread } from "@/server/messages/service";
import { getMyPage } from "@/server/pages/service";
import { getCurrentProfile } from "@/server/profile/service";
import { PageLogo } from "./page-logo";

/**
 * La bascule vers sa page (Profil) : comme sur Facebook, on passe de son compte
 * à sa page. Sans page, l'invitation à en créer une, pour qui a choisi de vendre.
 */
export async function PageSwitch() {
  const profile = await getCurrentProfile();
  const [page, t] = await Promise.all([
    getMyPage(profile.id),
    getTranslations("Pages.switch"),
  ]);
  if (page) {
    // Les messages de la page n’entrent pas dans la pastille de la Messagerie
    const unread = await countPageUnread(profile.id);
    return (
      <Link
        href="/pro"
        className="flex min-h-14 items-center gap-3 rounded-2xl bg-foreground/[0.05] p-2 pr-3 outline-none hover:bg-foreground/[0.08] focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PageLogo
          name={page.name}
          url={page.logoUrl}
          className="size-11 text-xl"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{t("toPage")}</span>
          <span className="truncate text-sm font-semibold">{page.name}</span>
          {unread > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-primary"
              />
              {t("unread", { count: unread })}
            </span>
          ) : null}
        </span>
        <ArrowLeftRight
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </Link>
    );
  }
  if (profile.accountType !== "affiliate") return null;
  return (
    <Link
      href="/pro/new"
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-foreground/15 p-3 outline-none hover:bg-foreground/[0.04] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Store aria-hidden="true" className="size-5 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{t("createTitle")}</span>
        <span className="text-xs text-muted-foreground">{t("createText")}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 text-muted-foreground"
      />
    </Link>
  );
}

/** Dans Réglages : la page pro, à ouvrir ou à créer. */
export async function PageSettings() {
  const profile = await getCurrentProfile();
  const [page, t] = await Promise.all([
    getMyPage(profile.id),
    getTranslations("Pages.settings"),
  ]);
  return (
    <section
      aria-labelledby="page-settings"
      className="flex max-w-2xl flex-col gap-3"
    >
      <h2 id="page-settings" className="font-heading text-lg font-bold">
        {t("title")}
      </h2>
      <p className="text-sm text-pretty text-muted-foreground">
        {t("description")}
      </p>
      {page ? (
        <div className="flex flex-wrap items-center gap-3">
          <PageLogo
            name={page.name}
            url={page.logoUrl}
            className="size-11 text-xl"
          />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {page.name}
          </span>
          <Button asChild variant="outline" className="h-11">
            <Link href="/pro">{t("open")}</Link>
          </Button>
        </div>
      ) : (
        <Button asChild className="h-11 w-fit">
          <Link href="/pro/new">
            <Store aria-hidden="true" />
            {t("create")}
          </Link>
        </Button>
      )}
    </section>
  );
}

export function PageSettingsSkeleton() {
  return <Skeleton className="h-32 max-w-2xl rounded-3xl" />;
}

/** Vendre demande une page : l'invitation à la créer. */
export async function CreatePageCard() {
  const t = await getTranslations("Pages.sell");
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Store aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Button asChild className="h-11 w-fit">
        <Link href="/pro/new">{t("action")}</Link>
      </Button>
    </section>
  );
}
