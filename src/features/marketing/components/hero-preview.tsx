"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Pillar } from "@/config/pillars";
import {
  QuestRow,
  type HabitQuest,
} from "@/features/today/components/quest-list";
import { SystemOrbit } from "@/features/today/components/system-orbit";
import { summarizeDay } from "@/features/today/day-plan";

// Valeurs d'illustration pour la page d'accueil : ce ne sont pas des données utilisateur.
const EXAMPLE = {
  /** Niveau mesuré : mieux que 62 % des gens du même âge. */
  level: 62,
  streakDays: 18,
  scores: {
    physical: 72,
    mental: 61,
    social: 48,
    financial: 67,
  } satisfies Record<Pillar, number>,
};

type ExampleQuest = {
  key: "workout" | "meditation" | "friend" | "budget";
  pillar: Pillar;
  /** Série avant aujourd'hui. */
  streak: number;
  done: boolean;
};

const EXAMPLE_QUESTS: readonly ExampleQuest[] = [
  { key: "workout", pillar: "physical", streak: 3, done: true },
  { key: "meditation", pillar: "mental", streak: 11, done: true },
  { key: "friend", pillar: "social", streak: 0, done: false },
  { key: "budget", pillar: "financial", streak: 2, done: false },
];

/**
 * Aperçu interactif de la page Aujourd'hui, avec les vrais composants : on peut
 * toucher un pilier pour filtrer et cocher les quêtes. Rien n'est enregistré.
 */
export function HeroPreview() {
  const t = useTranslations("Marketing.preview");
  const tQuests = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const [filter, setFilter] = useState<Pillar | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EXAMPLE_QUESTS.map((quest) => [quest.key, quest.done])),
  );

  const quests: HabitQuest[] = EXAMPLE_QUESTS.map((quest) => {
    const isDone = done[quest.key] ?? false;
    return {
      kind: "habit",
      key: quest.key,
      id: quest.key,
      title: t(`tasks.${quest.key}`),
      pillar: quest.pillar,
      done: isDone,
      time: null,
      late: false,
      streak: quest.streak + (isDone ? 1 : 0),
    };
  });
  const summary = summarizeDay(quests);
  const shown = filter
    ? quests.filter((quest) => quest.pillar === filter)
    : quests;

  return (
    <figure
      aria-label={t("label")}
      className="relative mx-auto w-full max-w-md"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl"
      />
      <div className="flex flex-col gap-4 rounded-[2rem] border border-foreground/10 bg-card/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t("level", { level: EXAMPLE.level })}
            </span>
            <span className="text-sm font-bold text-primary tabular-nums">
              {t("top", { top: 100 - EXAMPLE.level })}
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium">
            <Flame aria-hidden="true" className="size-3.5 text-primary" />
            {t("streak", { days: EXAMPLE.streakDays })}
          </span>
        </div>

        <SystemOrbit
          scores={EXAMPLE.scores}
          day={summary.day}
          pillars={summary.pillars}
          filter={filter}
          onFilterChange={setFilter}
          explain={false}
        />

        <div className="flex flex-col gap-2">
          <p className="font-heading font-bold">
            {filter
              ? tQuests("titleFiltered", {
                  pillar: tPillars(`${filter}.name`),
                })
              : tQuests("title")}
          </p>
          <ul className="flex flex-col gap-2">
            {shown.map((quest) => (
              <QuestRow
                key={quest.key}
                quest={quest}
                onToggle={() =>
                  setDone((current) => ({
                    ...current,
                    [quest.key]: !current[quest.key],
                  }))
                }
              />
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {t("example")}
      </figcaption>
    </figure>
  );
}
