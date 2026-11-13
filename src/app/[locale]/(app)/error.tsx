"use client";

import { ErrorScreen } from "@/components/error-screen";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

// Dans l'application : la barre du haut et celle du bas restent, seul le contenu
// montre l'erreur
export default function AppErrorPage({ error, retry }: ErrorPageProps) {
  return <ErrorScreen error={error} retry={retry} />;
}
