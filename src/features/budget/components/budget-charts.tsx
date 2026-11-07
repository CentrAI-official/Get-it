"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Chargés seulement quand il y a une courbe à montrer : le budget reste léger sur téléphone.

export const CashFlowChart = dynamic(
  () => import("./budget-charts-impl").then((module) => module.CashFlowChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-2xl" />,
  },
);

export const NetWorthChart = dynamic(
  () => import("./budget-charts-impl").then((module) => module.NetWorthChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-44 w-full rounded-2xl" />,
  },
);
