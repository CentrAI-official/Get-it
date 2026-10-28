import { THEME_SCRIPT } from "@/config/theme";

/**
 * Applique le thème avant l'affichage (premier élément du <body>) : la page ne
 * clignote pas d'un thème à l'autre au chargement.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
