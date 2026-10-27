import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  canManage,
  canRemove,
  GROUP_ERRORS,
  GROUP_NAME_MAX,
  GROUP_TOPICS,
  groupFiltersSchema,
  groupFormSchema,
  topicOf,
} from "./rules";

const valid = {
  locale: "fr",
  name: "  Coureurs du dimanche ",
  description: "",
  topic: "physical",
  visibility: "public",
};

describe("groupFormSchema", () => {
  it("accepte un groupe et nettoie le nom", () => {
    expect(groupFormSchema.parse(valid).name).toBe("Coureurs du dimanche");
  });

  it("refuse un nom trop court ou trop long, avec la bonne erreur", () => {
    const short = groupFormSchema.safeParse({ ...valid, name: "ab" });
    expect(short.success ? null : short.error.issues[0]?.message).toBe(
      "nameTooShort",
    );
    const long = groupFormSchema.safeParse({
      ...valid,
      name: "x".repeat(GROUP_NAME_MAX + 1),
    });
    expect(long.success ? null : long.error.issues[0]?.message).toBe(
      "nameTooLong",
    );
  });

  it("un pilier ou général, public ou privé", () => {
    expect(
      groupFormSchema.safeParse({ ...valid, topic: "general" }).success,
    ).toBe(true);
    expect(
      groupFormSchema.safeParse({ ...valid, topic: "sport" }).success,
    ).toBe(false);
    expect(
      groupFormSchema.safeParse({ ...valid, visibility: "secret" }).success,
    ).toBe(false);
    expect(topicOf(null)).toBe("general");
    expect(topicOf("mental")).toBe("mental");
  });
});

describe("rôles", () => {
  it("le créateur et les admins gèrent le groupe", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("admin")).toBe(true);
    expect(canManage("member")).toBe(false);
    expect(canManage(null)).toBe(false);
  });

  it("personne ne retire le créateur ; un admin ne retire que les membres", () => {
    expect(canRemove("owner", "admin")).toBe(true);
    expect(canRemove("owner", "member")).toBe(true);
    expect(canRemove("admin", "member")).toBe(true);
    expect(canRemove("admin", "admin")).toBe(false);
    expect(canRemove("admin", "owner")).toBe(false);
    expect(canRemove("member", "member")).toBe(false);
  });
});

describe("filtres de l'annuaire", () => {
  it("ignorent les valeurs inconnues", () => {
    expect(groupFiltersSchema.parse({ topic: "sport", q: "a" })).toEqual({});
    expect(
      groupFiltersSchema.parse({ topic: "general", q: " course " }),
    ).toEqual({ topic: "general", q: "course" });
  });
});

describe("textes et base", () => {
  it("chaque erreur et chaque sujet a son texte", () => {
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.Groups.errors).sort()).toEqual(
        [...GROUP_ERRORS].sort(),
      );
      for (const topic of GROUP_TOPICS) {
        expect(messages.Groups.topics[topic]).toBeTruthy();
      }
    }
  });

  it("la migration garde les mêmes limites de nom et de description", () => {
    const sql = readFileSync(
      "prisma/migrations/20261031140000_groups/migration.sql",
      "utf8",
    );
    expect(sql).toContain(
      `char_length(btrim("name")) BETWEEN 3 AND ${GROUP_NAME_MAX}`,
    );
    expect(sql).toContain(`char_length("description") <= 500`);
  });
});
