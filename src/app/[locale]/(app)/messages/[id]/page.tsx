import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  ConversationLoader,
  ConversationSkeleton,
} from "@/features/messages/components/messages-panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.messages");
  return { title: t("title") };
}

export default function ConversationPage({
  params,
}: PageProps<"/[locale]/messages/[id]">) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<ConversationSkeleton />}>
        {params.then(({ id }) => (
          <ConversationLoader id={id} />
        ))}
      </Suspense>
    </div>
  );
}
