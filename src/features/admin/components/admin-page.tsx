import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AdminPanelSkeleton } from "./dashboard-ui";

/** Page du dashboard : le titre, puis le panneau de données (chargé à part). */
export function AdminPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={title} description={description} />
      <Suspense fallback={<AdminPanelSkeleton />}>{children}</Suspense>
    </div>
  );
}
