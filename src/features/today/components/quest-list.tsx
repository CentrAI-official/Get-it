"use client";

import { Check, Handshake, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Pillar } from "@/config/pillars";
import { AddItemForm } from "@/features/goals/components/checklist";
import { addTaskAction } from "@/features/tasks/actions";
import { clockDate, toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FocusDay } from "../focus";

type QuestBase = {
  /** « habit:<id> » ou « task:<id> » */
  key: string;
  id: string;
  title: string;
  done: boolean;
  /** XP rapportée (ou déjà gagnée) ; 0 au-delà du plafond quotidien de tâches. */
  xp: number;
  /** Heure prévue (minutes depuis minuit) ; null : pas d’heure. */
  time: number | null;
};

export type HabitQuest = QuestBase & {
  kind: "habit";
  pillar: Pillar;
  /** Série en cours, recalculée à chaque clic. */
  streak: number;
  /** Derniers jours, pour le mode Focus de Ma journée. */
  days?: FocusDay[];
  late: false;
  /** Pacte en cours sur cette habitude (Messagerie). */
  pact?: {
    partnerName: string;
    dayIndex: number;
    days: number;
    partnerDone: boolean;
  };
};

export type TaskQuest = QuestBase & {
  kind: "task";
  /** Pilier de l'objectif ; null pour une tâche indépendante. */
  pillar: Pillar | null;
  /** Due avant aujourd'hui. */
  late: boolean;
  dueDate: string | null;
  goalTitle: string | null;
};

export type Quest = HabitQuest | TaskQuest;

/** Les tâches ajoutées ici ne sont rattachées à aucun objectif. */
const addStandaloneTask = addTaskAction.bind(null, null);

type QuestListProps = {
  /** Quêtes affichées (déjà filtrées par pilier). */
  quests: Quest[];
  filter: Pillar | null;
  today: string;
  /** Un clic est en cours d'enregistrement. */
  pending: boolean;
  /** Tout ce qui est prévu aujourd'hui est fait. */
  allDone: boolean;
  onToggle: (quest: Quest) => void;
  onDelete: (quest: TaskQuest) => void;
  onClearFilter: () => void;
  className?: string;
};

/** Quêtes du jour : habitudes prévues et tâches, à cocher en un geste. */
export function QuestList({
  quests,
  filter,
  today,
  pending,
  allDone,
  onToggle,
  onDelete,
  onClearFilter,
  className,
}: QuestListProps) {
  const t = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const tTasks = useTranslations("Goals.tasks");
  const pillarName = filter ? tPillars(`${filter}.name`) : "";

  return (
    <section
      aria-labelledby="quests-title"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2
          id="quests-title"
          tabIndex={-1}
          className="caps-label text-muted-foreground outline-none"
        >
          {filter ? t("titleFiltered", { pillar: pillarName }) : t("title")}
        </h2>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs"
          >
            {pending ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
                {t("saving")}
              </>
            ) : null}
          </span>
        </div>
      </div>

      {quests.length > 0 ? (
        <ul className="flex flex-col">
          {quests.map((quest) => (
            <QuestRow
              key={quest.key}
              quest={quest}
              onToggle={() => onToggle(quest)}
              onDelete={
                quest.kind === "task" ? () => onDelete(quest) : undefined
              }
              deleteLabel={tTasks("delete", { title: quest.title })}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            {filter ? t("emptyFiltered", { pillar: pillarName }) : t("empty")}
          </p>
          {filter ? (
            <Button variant="outline" size="sm" onClick={onClearFilter}>
              {t("showAll")}
            </Button>
          ) : null}
        </div>
      )}

      {allDone ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <Sparkles aria-hidden="true" className="size-4" />
          {t("allDone")}
        </p>
      ) : null}

      <div id="nouvelle-tache" className="pt-1">
        <AddItemForm
          action={addStandaloneTask}
          label={tTasks("addLabel")}
          placeholder={tTasks("placeholder")}
          submitLabel={tTasks("add")}
          dateLabel={tTasks("dueDateLabel")}
          defaultDate={today}
        />
      </div>
    </section>
  );
}

/**
 * Ligne d'information d'une quête : « Habitude · Physique · série de 12 j »,
 * « En retard · 12 oct. · Objectif ».
 */
export function useQuestMeta() {
  const t = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const format = useFormatter();

  function taskMeta(task: TaskQuest) {
    const due =
      task.late && task.dueDate
        ? t("taskOverdue", {
            // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
            date: format.dateTime(toDbDate(task.dueDate), {
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            }),
          })
        : t("taskToday");
    return task.goalTitle
      ? t("withGoal", { meta: due, goal: task.goalTitle })
      : due;
  }

  function habitMeta(habit: HabitQuest) {
    const meta = t("habit", { pillar: tPillars(`${habit.pillar}.name`) });
    return habit.streak > 0
      ? t("withStreak", { meta, count: habit.streak })
      : meta;
  }

  return (quest: Quest) => {
    const meta = quest.kind === "habit" ? habitMeta(quest) : taskMeta(quest);
    return quest.time === null
      ? meta
      : t("atTime", {
          time: format.dateTime(clockDate(quest.time), {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
          }),
          meta,
        });
  };
}

/** Pacte en cours sur une habitude : jour du pacte et part du partenaire. */
export function QuestPact({ pact }: { pact: NonNullable<HabitQuest["pact"]> }) {
  const t = useTranslations("Today.quests");
  return (
    <span className="flex items-start gap-1.5 text-xs text-primary">
      <Handshake aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="break-words">
        {t("pact", {
          name: pact.partnerName,
          day: pact.dayIndex,
          days: pact.days,
        })}
        {" · "}
        {pact.partnerDone
          ? t("pactPartnerDone", { name: pact.partnerName })
          : t("pactPartnerPending", { name: pact.partnerName })}
      </span>
    </span>
  );
}

type QuestRowProps = {
  quest: Quest;
  onToggle: () => void;
  /** Seules les tâches se suppriment d'ici. */
  onDelete?: () => void;
  deleteLabel?: string;
};

/** Une quête à cocher (aussi utilisée dans l'aperçu du site public). */
export function QuestRow({
  quest,
  onToggle,
  onDelete,
  deleteLabel,
}: QuestRowProps) {
  const t = useTranslations("Today.quests");
  const questMeta = useQuestMeta();
  // Chaque coche qui rapporte de l'XP relance la petite animation « +10 XP »
  const [burst, setBurst] = useState(0);

  function toggle() {
    if (!quest.done && quest.xp > 0) setBurst((count) => count + 1);
    onToggle();
  }

  const meta = questMeta(quest);
  const pact = quest.kind === "habit" ? quest.pact : undefined;

  return (
    <li
      className={cn(
        "relative flex items-center gap-2 border-b border-foreground/8 py-2 transition-colors duration-200",
        quest.done ? "text-muted-foreground" : null,
      )}
    >
      <button
        type="button"
        aria-pressed={quest.done}
        onClick={toggle}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
            quest.done
              ? "bg-primary text-primary-foreground glow-primary"
              : "border-2 border-foreground/20",
          )}
        >
          {quest.done ? (
            <Check className="size-[18px]" strokeWidth={3} />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "font-medium break-words",
              quest.done && "text-muted-foreground line-through",
            )}
          >
            {quest.title}
          </span>
          {pact ? <QuestPact pact={pact} /> : null}
          <span
            className={cn(
              "text-xs break-words",
              quest.late && !quest.done
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        </span>
      </button>

      {quest.xp > 0 ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums transition-colors",
            quest.kind === "habit" && "mr-1",
            quest.done
              ? "bg-primary text-primary-foreground"
              : "bg-primary/12 text-primary",
          )}
        >
          {quest.done ? (
            <>
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
              {t("xpEarned", { xp: quest.xp })}
            </>
          ) : (
            t("xpReward", { xp: quest.xp })
          )}
        </span>
      ) : null}
      {burst > 0 ? (
        // Retiré à la fin de l'animation ; jamais affiché si les animations sont réduites
        <span
          key={burst}
          aria-hidden="true"
          onAnimationEnd={() => setBurst(0)}
          className="pointer-events-none absolute -top-2 right-12 hidden text-sm font-bold text-primary tabular-nums opacity-0 motion-safe:block motion-safe:animate-xp-float"
        >
          {t("xpReward", { xp: quest.xp })}
        </span>
      ) : null}
      {quest.kind === "task" && onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={deleteLabel}
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}
