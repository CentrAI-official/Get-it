import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ClientsSkeleton } from "@/features/clients/components/clients-views";
import { ProposalReview } from "@/features/clients/components/proposal-views";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients.proposals");
  return { title: t("reviewPageTitle") };
}

// Sur son compte : une modification de plan proposée par un pro
export default function ProposalPage({
  params,
}: PageProps<"/[locale]/profile/pros/changes/[id]">) {
  const t = useTranslations("Clients.pros");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/profile/pros" label={t("title")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<ClientsSkeleton />}>
        {params.then(({ id }) => (
          <ProposalReview proposalId={id} />
        ))}
      </Suspense>
    </div>
  );
}
