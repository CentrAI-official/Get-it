import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  LevelsPanel,
  LevelsSkeleton,
} from "@/features/levels/components/levels-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Levels");
  return { title: t("title") };
}

// Profil › Mes niveaux : mesures comparées aux gens de son âge au Canada et aux
// États-Unis, objectifs de niveau et mode Ranked (adresse conservée)
export default function LevelsPage({
  searchParams,
}: PageProps<"/[locale]/profile/ranked">) {
  const t = useTranslations("Levels");
  const tRanked = useTranslations("Ranked");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href="/profile" label={t("back")} />
        <PageHeader
          title={t("title")}
          description={t("description")}
          action={
            <Button asChild variant="outline">
              <Link href="/profile/ranked/leaderboard">
                <Trophy aria-hidden="true" className="text-primary" />
                {tRanked("leaderboard.link")}
              </Link>
            </Button>
          }
        />
      </div>
      <Suspense fallback={<LevelsSkeleton />}>
        <LevelsPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
