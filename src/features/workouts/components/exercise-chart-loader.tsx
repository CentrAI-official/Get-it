"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chargé seulement quand il y a une courbe à montrer : la fiche d'un exercice
 * reste légère sur téléphone pour qui n'a pas encore d'historique.
 */
export const ExerciseChart = dynamic(
  () => import("./exercise-chart").then((module) => module.ExerciseChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full rounded-2xl" />,
  },
);
