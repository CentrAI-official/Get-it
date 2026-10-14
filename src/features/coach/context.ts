import { PILLARS, type Pillar } from "@/config/pillars";

// Contexte envoyé à Get iT AI (§16) : un résumé structuré et borné des données
// de l'utilisateur, jamais l'historique brut. En anglais : il s'adresse au modèle.

export type CoachContextData = {
  /** « AAAA-MM-JJ », dans le fuseau de l'utilisateur. */
  today: string;
  name: string | null;
  occupation: string | null;
  focusPillars: Pillar[];
  dailyMinutes: number | null;
  level: { level: number; xp: number; pillarLevels: Record<Pillar, number> };
  /** 0 à 100, null sans données. */
  scores: Record<Pillar, number | null>;
  quests: {
    title: string;
    kind: "habit" | "task";
    pillar: Pillar | null;
    done: boolean;
    /** Tâche en retard : sa date d'échéance. */
    overdueSince: string | null;
    goal: string | null;
    streak: number | null;
  }[];
  goals: {
    /** Référence courte donnée au modèle pour lier une proposition (G1, G2…). */
    ref: string;
    title: string;
    pillar: Pillar;
    targetDate: string | null;
    milestones: { title: string; done: boolean }[];
    openTasks: { title: string; dueDate: string | null }[];
  }[];
  habits: {
    title: string;
    pillar: Pillar;
    weekdays: number[];
    currentStreak: number;
    bestStreak: number;
    doneToday: boolean;
  }[];
  checkIns: {
    day: string;
    mood: number;
    energy: number;
    stress: number;
    sleep: number;
  }[];
};

/** Limites du contexte : il reste court, donc rapide et peu coûteux. */
export const CONTEXT_LIMITS = {
  quests: 15,
  goals: 6,
  milestonesPerGoal: 8,
  tasksPerGoal: 5,
  habits: 10,
  checkIns: 7,
} as const;

const PILLAR_NAMES: Record<Pillar, string> = {
  physical: "Physical",
  mental: "Mental",
  social: "Social",
  financial: "Financial",
};
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const quote = (text: string) => `"${text.replace(/\s+/g, " ").trim()}"`;

function schedule(weekdays: number[]) {
  if (weekdays.length === 7) return "every day";
  return weekdays.map((day) => WEEKDAY_NAMES[day - 1]).join(", ");
}

/** Le contexte de l'utilisateur, en texte compact pour le modèle. */
export function formatCoachContext(data: CoachContextData): string {
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${data.today}T00:00:00Z`));

  const profile = [
    data.name ? `Name: ${data.name}` : null,
    data.occupation ? `Occupation: ${data.occupation}` : null,
    data.focusPillars.length > 0
      ? `Focus pillars: ${data.focusPillars.map((p) => PILLAR_NAMES[p]).join(", ")}`
      : null,
    data.dailyMinutes
      ? `Time available per day: ${data.dailyMinutes} min`
      : null,
  ].filter(Boolean);

  const lines = [
    "<user_context>",
    `Today: ${data.today} (${weekday})`,
    profile.join(" · "),
    `Level ${data.level.level} (${data.level.xp} XP). Pillar levels: ${PILLARS.map(
      (p) => `${PILLAR_NAMES[p]} ${data.level.pillarLevels[p]}`,
    ).join(", ")}.`,
    `Pillar scores /100 (40% self-assessment + 60% consistency over the last 7 days): ${PILLARS.map(
      (p) =>
        `${PILLAR_NAMES[p]} ${data.scores[p] === null ? "no data" : data.scores[p]}`,
    ).join(", ")}.`,
    "",
    "Today's quests:",
  ];

  const quests = data.quests.slice(0, CONTEXT_LIMITS.quests);
  if (quests.length === 0) lines.push("- none planned");
  for (const quest of quests) {
    const details = [
      quest.kind,
      quest.pillar ? PILLAR_NAMES[quest.pillar] : null,
      quest.streak ? `streak ${quest.streak} days` : null,
      quest.overdueSince ? `overdue since ${quest.overdueSince}` : null,
      quest.goal ? `goal ${quote(quest.goal)}` : null,
    ].filter(Boolean);
    lines.push(
      `- [${quest.done ? "done" : "todo"}] ${quote(quest.title)} (${details.join(", ")})`,
    );
  }

  lines.push("", "Active goals:");
  const goals = data.goals.slice(0, CONTEXT_LIMITS.goals);
  if (goals.length === 0) lines.push("- none yet");
  for (const goal of goals) {
    const done = goal.milestones.filter((m) => m.done).length;
    lines.push(
      `- [${goal.ref}] ${quote(goal.title)} (${PILLAR_NAMES[goal.pillar]}${
        goal.targetDate ? `, target ${goal.targetDate}` : ""
      }, milestones ${done}/${goal.milestones.length} done)`,
    );
    const milestones = goal.milestones.slice(
      0,
      CONTEXT_LIMITS.milestonesPerGoal,
    );
    if (milestones.length > 0) {
      lines.push(
        `  Milestones: ${milestones
          .map((m) => `[${m.done ? "done" : "todo"}] ${quote(m.title)}`)
          .join("; ")}`,
      );
    }
    const tasks = goal.openTasks.slice(0, CONTEXT_LIMITS.tasksPerGoal);
    if (tasks.length > 0) {
      lines.push(
        `  Open tasks: ${tasks
          .map(
            (t) => `${quote(t.title)}${t.dueDate ? ` (due ${t.dueDate})` : ""}`,
          )
          .join("; ")}`,
      );
    }
  }

  lines.push("", "Habits:");
  const habits = data.habits.slice(0, CONTEXT_LIMITS.habits);
  if (habits.length === 0) lines.push("- none yet");
  for (const habit of habits) {
    lines.push(
      `- ${quote(habit.title)} (${PILLAR_NAMES[habit.pillar]}, ${schedule(habit.weekdays)}, current streak ${habit.currentStreak}, best ${habit.bestStreak}${
        habit.doneToday ? ", done today" : ""
      })`,
    );
  }

  lines.push(
    "",
    "Daily check-ins, last 7 days (1-5; for stress, 5 = very high):",
  );
  const checkIns = data.checkIns.slice(-CONTEXT_LIMITS.checkIns);
  if (checkIns.length === 0) lines.push("- none");
  for (const c of checkIns) {
    lines.push(
      `- ${c.day}: mood ${c.mood}, energy ${c.energy}, stress ${c.stress}, sleep ${c.sleep}`,
    );
  }
  lines.push("</user_context>");

  return lines.join("\n");
}
