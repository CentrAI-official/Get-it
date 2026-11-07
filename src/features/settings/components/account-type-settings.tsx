import {
  PageSettings,
  PageSettingsSkeleton,
} from "@/features/pages/components/page-switch";

/**
 * La page pro (qui remplace le choix consommateur ou affilié) : l'ouvrir ou la
 * créer. Lit la session : à placer dans un <Suspense>.
 */
export const AccountTypeSettings = PageSettings;
export const AccountTypeSettingsSkeleton = PageSettingsSkeleton;
