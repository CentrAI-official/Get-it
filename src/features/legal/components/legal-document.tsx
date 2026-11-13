import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LEGAL_VERSION, type LegalDocument } from "@/config/legal";
import { fillLegal, legalText } from "@/content/legal";
import { toDbDate } from "@/lib/dates";
import { privacyOfficer } from "@/server/legal/service";

/**
 * La politique de confidentialité ou les conditions d'utilisation. Introuvables
 * tant que la personne responsable (Loi 25) n'est pas configurée.
 */
export async function LegalDocumentPage({ kind }: { kind: LegalDocument }) {
  const officer = privacyOfficer();
  if (!officer) notFound();
  const [t, format, locale] = await Promise.all([
    getTranslations("Legal"),
    getFormatter(),
    getLocale(),
  ]);
  const text = legalText(locale, kind);
  const contact = kind === "privacy" ? text.officer : text.contact;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-[0.95] text-balance uppercase sm:text-5xl">
          {text.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("updated", {
            date: format.dateTime(toDbDate(LEGAL_VERSION), {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }),
          })}
        </p>
        <p className="text-pretty">{text.intro}</p>
      </header>
      {text.sections.map((section) => (
        <section
          key={section.title}
          className="flex flex-col gap-3 border-t border-foreground/8 pt-6"
        >
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-pretty text-foreground/85">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      {contact ? (
        <section className="flex flex-col gap-3 border-t border-foreground/8 pt-6">
          <h2 className="text-lg font-semibold">{t("contactTitle")}</h2>
          <p className="text-pretty">{fillLegal(contact, officer)}</p>
        </section>
      ) : null}
    </article>
  );
}
