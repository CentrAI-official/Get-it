import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClientsSkeleton } from "@/features/clients/components/clients-views";
import { ClientPlanEditorView } from "@/features/clients/components/proposal-views";
import { BackToClient } from "./back-to-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients.proposals");
  return { title: t("editorTitle") };
}

// Sur sa page : modifier un plan qu'un client montre (il doit accepter)
export default function ClientPlanEditPage({
  params,
}: PageProps<"/[locale]/clients/[id]/plans/[kind]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Les paramètres ne sont connus qu'à la requête : lus dans le Suspense */}
      <Suspense fallback={<ClientsSkeleton />}>
        {params.then(({ id, kind }) => (
          <>
            <BackToClient clientId={id} />
            <ClientPlanEditorView clientId={id} kind={kind} />
          </>
        ))}
      </Suspense>
    </div>
  );
}
