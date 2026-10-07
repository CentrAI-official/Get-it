import Link from "next/link";
import "./globals.css";

// Affichée quand l'URL ne correspond à aucune langue (ex. /fichier-inconnu.txt) :
// la langue est inconnue, le message est donc bilingue.
export default function GlobalNotFound() {
  return (
    <html lang="fr" className="dark">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
        <main className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-semibold tracking-widest text-primary">
            404
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Page introuvable · Page not found
          </h1>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Get iT
          </Link>
        </main>
      </body>
    </html>
  );
}
