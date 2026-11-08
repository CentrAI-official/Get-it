import { IDENTITY_SCRIPT } from "@/config/identity";

/**
 * Applique le compte actif avant l'affichage (après ThemeScript) : la
 * navigation de la page s'affiche sans passer par celle du compte personnel.
 */
export function IdentityScript() {
  return <script dangerouslySetInnerHTML={{ __html: IDENTITY_SCRIPT }} />;
}
