"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { noteNavigation } from "@/lib/nav-history";

/**
 * Compte les pages vues (voir nav-history.ts). Monté une fois dans la mise en
 * page de l'application, dans un <Suspense> : usePathname suspend sur les
 * routes à paramètre dynamique.
 */
export function NavigationMemory() {
  const pathname = usePathname();
  useEffect(() => {
    noteNavigation(pathname);
  }, [pathname]);
  return null;
}
