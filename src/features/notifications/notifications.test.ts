import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { NOTIFICATION_KINDS, notificationText } from "./rules";

describe("notifications", () => {
  it("regroupe les messages, les commentaires et les j'aime", () => {
    const base = { name: "Léa", subject: "", count: 1 };
    expect(notificationText("message", base).key).toBe("message");
    expect(notificationText("message", { ...base, count: 3 }).key).toBe(
      "messages",
    );
    expect(
      notificationText("message", { ...base, subject: "Coureurs" }).key,
    ).toBe("groupMessage");
    const likes = notificationText("like", { ...base, count: 4 });
    expect(likes.key).toBe("likes");
    expect(likes.values.others).toBe(3);
    expect(notificationText("comment", { ...base, count: 2 }).key).toBe(
      "comments",
    );
  });

  it("chaque texte existe en français et en anglais", () => {
    const keys = [
      ...NOTIFICATION_KINDS,
      "groupMessage",
      "messages",
      "likes",
      "comments",
    ];
    for (const key of keys) {
      expect(fr.Notifications.items).toHaveProperty(key);
      expect(en.Notifications.items).toHaveProperty(key);
    }
  });

  it("la migration garde les mêmes types et active le RLS", () => {
    const read = (name: string) =>
      readFileSync(
        new URL(
          `../../../prisma/migrations/${name}/migration.sql`,
          import.meta.url,
        ),
        "utf8",
      );
    // « story » s'ajoute dans sa propre migration (valeur d'enum à part)
    const sql =
      read("20261101140000_notifications") + read("20261106120000_story_kinds");
    for (const kind of NOTIFICATION_KINDS) expect(sql).toContain(`'${kind}'`);
    expect(sql).toContain(
      'ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY',
    );
    expect(sql).toContain(
      'ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY',
    );
  });
});
