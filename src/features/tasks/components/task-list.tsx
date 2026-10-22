"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AddItemForm,
  ChecklistItem,
} from "@/features/goals/components/checklist";
import { toDbDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addTaskAction, deleteTaskAction, setTaskDoneAction } from "../actions";

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  /** Objectif de la tâche, affiché quand la liste mélange plusieurs objectifs. */
  goal?: { id: string; title: string } | null;
};

type TaskListProps = {
  /** Objectif des tâches ; null pour des tâches indépendantes. */
  goalId: string | null;
  tasks: Task[];
  /** Aujourd'hui dans le fuseau de l'utilisateur, « AAAA-MM-JJ ». */
  today: string;
  /** Message quand il n'y a rien à faire (par défaut : celui d'un objectif). */
  emptyMessage?: string;
  /** Échéance proposée pour une nouvelle tâche (ex. aujourd'hui). */
  defaultDueDate?: string;
};

export function TaskList({
  goalId,
  tasks,
  today,
  emptyMessage,
  defaultDueDate,
}: TaskListProps) {
  const t = useTranslations("Goals.tasks");
  const open = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  function renderTask(task: Task) {
    return (
      <ChecklistItem
        key={task.id}
        id={task.id}
        title={task.title}
        done={task.done}
        meta={
          task.dueDate || task.goal ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {task.dueDate ? (
                <DueDate day={task.dueDate} today={today} done={task.done} />
              ) : null}
              {task.goal ? (
                <span className="text-xs text-muted-foreground">
                  {task.goal.title}
                </span>
              ) : null}
            </span>
          ) : null
        }
        onToggle={(value) => setTaskDoneAction(task.id, value)}
        onDelete={() => deleteTaskAction(task.id)}
        deleteLabel={t("delete", { title: task.title })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {open.length > 0 ? (
        <ul className="flex flex-col">{open.map(renderTask)}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {emptyMessage ?? t("empty")}
        </p>
      )}
      <AddItemForm
        action={addTaskAction.bind(null, goalId)}
        label={t("addLabel")}
        placeholder={t("placeholder")}
        submitLabel={t("add")}
        dateLabel={t("dueDateLabel")}
        defaultDate={defaultDueDate}
      />
      {done.length > 0 ? (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-90"
            />
            {t("doneCount", { count: done.length })}
          </summary>
          <ul className="mt-2 flex flex-col">{done.map(renderTask)}</ul>
        </details>
      ) : null}
    </div>
  );
}

function DueDate({
  day,
  today,
  done,
}: {
  day: string;
  today: string;
  done: boolean;
}) {
  const t = useTranslations("Goals.tasks");
  const format = useFormatter();
  const overdue = !done && day < today;
  // Jour du calendrier : formaté en UTC pour ne pas glisser d'un jour
  const date = format.dateTime(toDbDate(day), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        overdue ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <CalendarDays aria-hidden="true" className="size-3" />
      {day === today ? t("dueToday") : t("due", { date })}
      {overdue ? ` · ${t("overdue")}` : null}
    </span>
  );
}
