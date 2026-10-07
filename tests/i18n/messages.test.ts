import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else Object.assign(result, flatten(value, path));
  }
  return result;
}

const catalogs: Record<string, Record<string, string>> = {
  fr: flatten(fr),
  en: flatten(en),
};

describe("traductions", () => {
  it("existent pour chaque langue du routage", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...routing.locales].sort());
  });

  it("ont exactement les mêmes clés en français et en anglais", () => {
    expect(Object.keys(catalogs.en ?? {}).sort()).toEqual(
      Object.keys(catalogs.fr ?? {}).sort(),
    );
  });

  it.each(Object.entries(catalogs))(
    "ne contiennent aucun texte vide (%s)",
    (_locale, messages) => {
      const empty = Object.entries(messages)
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty).toEqual([]);
    },
  );

  it("correspondent à l'enum Locale de la base de données", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const values = schema
      .match(/enum Locale \{([^}]*)\}/)?.[1]
      ?.split(/\s+/)
      .filter(Boolean);
    expect(values?.sort()).toEqual([...routing.locales].sort());
  });
});
