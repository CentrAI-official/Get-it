"use client";

import { ErrorScreen } from "@/components/error-screen";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

// Hors de l'application (site public, connexion) : la page entière
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  return <ErrorScreen error={error} retry={retry} fullScreen />;
}
