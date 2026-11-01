"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setTrackedPath, startTracking } from "../tracker";

/**
 * Mesure le temps actif par page de l'application. Monté une fois dans la mise
 * en page de l'application, dans un <Suspense> : usePathname suspend sur les
 * routes à paramètre dynamique.
 */
export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => startTracking(), []);
  useEffect(() => {
    setTrackedPath(pathname);
  }, [pathname]);

  return null;
}
