"use client";

import {
  Check,
  Flame,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { Pillar } from "@/config/pillars";
import { AddItemForm } from "@/features/goals/components/checklist";
import { addTaskAction } from "@/features/tasks/actions";
import { Link } from "@/i18n/navigation";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { focusNewTaskForm, NEW_TASK_ANCHOR } from "../new-task";

type QuestBase = {
  /** « habit:<id> » ou « task:<id> » */
  key: string;
  id: string;
  title: string;
  done: boolean;
};

export type HabitQuest = QuestBase & {
  kind: "habit";
  pillar: Pillar;
  /** Série en cours, recalculée à chaque clic. */
  streak: number;
  late: false;
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
  /** L'utilisateur a au moins une habitude active. */
  hasHabits: boolean;
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
  hasHabits,
  onToggle,
  onDelete,
  onClearFilter,
  className,
}: QuestListProps) {
  const t = useTranslations("Today.quests");
  const tPillars = useTranslations("Pillars");
  const tTasks = useTranslations("Goals.tasks");
  const pillarName = filter ? tPillars(`${filter}.name`) : "";
  const count = {
    done: quests.filter((quest) => quest.done).length,
    total: quests.length,
  };

  // Arrivée par le bouton « + » → « Nouvelle tâche » depuis une autre page
  useEffect(() => {
    if (window.location.hash === `#${NEW_TASK_ANCHOR}`) focusNewTaskForm();
  }, []);

  return (
    <section
      aria-labelledby="quests-title"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2
          id="quests-title"
          tabIndex={-1}
          className="font-heading text-lg font-bold outline-none"
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
          {count.total > 0 ? (
            <>
              <span aria-hidden="true" className="font-mono text-sm">
                {t("count", count)}
              </span>
              <span className="sr-only">{t("countLabel", count)}</span>
            </>
          ) : null}
        </div>
      </div>

      {quests.length > 0 ? (
        <ul className="flex flex-col gap-2">
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
        <div className="flex flex-col items-start gap-3 rounded-2xl glass p-4">
          <p className="text-sm text-muted-foreground">
            {filter ? t("emptyFiltered", { pillar: pillarName }) : t("empty")}
          </p>
          {filter ? (
            <Button variant="outline" size="sm" onClick={onClearFilter}>
              {t("showAll")}
            </Button>
          ) : !hasHabits ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/habits/new">
                <Plus aria-hidden="true" />
                {t("createHabit")}
              </Link>
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

      <div id={NEW_TASK_ANCHOR} className="scroll-mt-24 pt-1">
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
  const tPillars = useTranslations("Pillars");
  const tHabits = useTranslations("Habits");
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

  const meta =
    quest.kind === "habit"
      ? t("habit", { pillar: tPillars(`${quest.pillar}.name`) })
      : taskMeta(quest);

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-2xl border p-2 transition-colors duration-200",
        quest.done
          ? "border-primary/30 bg-primary/[0.07]"
          : "border-white/8 bg-white/[0.035]",
      )}
    >
      <button
        type="button"
        aria-pressed={quest.done}
        onClick={onToggle}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-200",
            quest.done
              ? "bg-primary text-primary-foreground glow-primary"
              : "border-2 border-white/20",
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

      {quest.kind === "habit" ? (
        <span
          title={tHabits("streak", { count: quest.streak })}
          className={cn(
            "mr-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs font-bold transition-colors",
            quest.done
              ? "bg-primary text-primary-foreground"
              : quest.streak > 0
                ? "bg-primary/12 text-primary"
                : "bg-white/5 text-muted-foreground",
          )}
        >
          <Flame aria-hidden="true" className="size-3.5" />
          <span aria-hidden="true">{quest.streak}</span>
          <span className="sr-only">
            {tHabits("streak", { count: quest.streak })}
          </span>
        </span>
      ) : onDelete ? (
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
