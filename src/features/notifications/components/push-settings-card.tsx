import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerEnv } from "@/server/env";
import { PushSettings } from "./push-settings";

/** Réglages › Notifications sur cet appareil (sans clés VAPID : rien à régler). */
export function PushSettingsCard() {
  const t = useTranslations("Notifications.push");
  const publicKey = getServerEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !getServerEnv().VAPID_PRIVATE_KEY) return null;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <PushSettings publicKey={publicKey} />
      </CardContent>
    </Card>
  );
}
