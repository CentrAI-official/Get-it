import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/** Réglages : un lien vers « Donner mon avis ». */
export function FeedbackCard() {
  const t = useTranslations("Feedback");
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/settings/feedback">
            <MessageSquareText aria-hidden="true" />
            {t("open")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
