import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import {
  PostPageLoader,
  PostPageSkeleton,
} from "@/features/community/components/post-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Community.postPage");
  return { title: t("metaTitle") };
}

// Une publication ouverte par son lien : réservée aux membres connectés
export default function PostPage({
  params,
}: PageProps<"/[locale]/community/posts/[id]">) {
  const t = useTranslations("Community.postPage");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/community" label={t("back")} />
      {/* L'id n'est connu qu'à la requête : lu dans le Suspense */}
      <Suspense fallback={<PostPageSkeleton />}>
        {params.then(({ id }) => (
          <PostPageLoader postId={id} />
        ))}
      </Suspense>
    </div>
  );
}
