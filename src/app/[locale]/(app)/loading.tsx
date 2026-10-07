import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  const t = useTranslations("Common");

  return (
    <div role="status" className="flex flex-col gap-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
