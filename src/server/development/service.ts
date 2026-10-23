import "server-only";
import {
  DAILY_DEVELOPMENT_PLANS,
  storedPlanSchema,
  type DevelopmentPlan,
  type DevelopmentSelection,
} from "@/features/development/plan";
import {
  developmentInstructions,
  developmentPrompt,
} from "@/features/development/prompts";
import {
  KIND_PILLAR,
  parseAnswers,
  type Answers,
  type DevelopmentKind,
} from "@/features/development/questionnaires";
import {
  monthOf,
  monthRange,
  planPeriod,
  type CalendarData,
  type Month,
} from "@/features/development/calendar";
import { addDays, fromDbDate, toCalendarDay, toDbDate } from "@/lib/dates";
import { getUserTimeZone } from "@/server/profile/service";
import { getAiProvider } from "@/server/ai/provider";
import {
  getAiProfile,
  recordAiUsage,
  releaseAiRequest,
  reserveAiRequest,
} from "@/server/ai/usage";
import { db } from "@/server/db";

// « Mon développement » : chaque fonction reçoit l'userId de la session. Les
// réponses au questionnaire sont des renseignements sensibles : elles ne
// quittent le serveur que vers Get iT AI, avec l'accord de l'utilisateur.

export type DevelopmentError =
  | "notConfigured"
  | "consentRequired"
  | "dataConsentRequired"
  | "invalid"
  | "dailyLimit"
  | "limitReached"
  | "refused"
  | "crisis"
  | "notFound"
  | "unexpected";

export type StoredDevelopmentPlan = {
  kind: DevelopmentKind;
  answers: Answers;
  plan: DevelopmentPlan;
  updatedAt: string;
};

/** Plans existants (accueil de « Mon développement »). */
export async function listPlans(userId: string) {
  const rows = await db.developmentPlan.findMany({
    where: { userId },
    select: { kind: true, plan: true, updatedAt: true },
  });
  return rows.flatMap((row) => {
    const plan = storedPlanSchema.safeParse(row.plan);
    return plan.success
      ? [
          {
            kind: row.kind,
            title: plan.data.title,
            updatedAt: row.updatedAt.toISOString(),
          },
        ]
      : [];
  });
}

/** Le plan d'un type, ou null s'il n'existe pas encore. */
export async function getPlan(
  userId: string,
  kind: DevelopmentKind,
): Promise<StoredDevelopmentPlan | null> {
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind } },
    select: { answers: true, plan: true, updatedAt: true },
  });
  if (!row) return null;
  const plan = storedPlanSchema.safeParse(row.plan);
  if (!plan.success) return null;
  return {
    kind,
    answers: row.answers as Answers,
    plan: plan.data,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Plans générés aujourd'hui (jour de l'utilisateur). */
async function plansToday(userId: string, timeZone: string) {
  return db.aiRequest.count({
    where: {
      userId,
      kind: "development_plan",
      day: toDbDate(toCalendarDay(new Date(), timeZone)),
    },
  });
}

/**
 * Génère (ou refait) un plan à partir du questionnaire. Les réponses sont
 * revalidées ; rien n'est enregistré si Get iT AI signale une détresse.
 */
export async function generatePlan(
  userId: string,
  kind: DevelopmentKind,
  rawAnswers: unknown,
  dataConsent: boolean,
): Promise<
  | { ok: true }
  | { ok: false; error: DevelopmentError; fields?: Record<string, string> }
> {
  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "notConfigured" };
  const profile = await getAiProfile(userId);
  if (!profile) return { ok: false, error: "notFound" };
  if (!profile.consented) return { ok: false, error: "consentRequired" };
  if (!dataConsent) return { ok: false, error: "dataConsentRequired" };

  const today = toCalendarDay(new Date(), profile.timeZone);
  const parsed = parseAnswers(kind, rawAnswers, today);
  if (!parsed.ok) return { ok: false, error: "invalid", fields: parsed.fields };
  if ((await plansToday(userId, profile.timeZone)) >= DAILY_DEVELOPMENT_PLANS) {
    return { ok: false, error: "dailyLimit" };
  }
  const reservation = await reserveAiRequest(
    userId,
    "development_plan",
    profile.timeZone,
  );
  if (!reservation) return { ok: false, error: "limitReached" };

  const result = await provider
    .generateDevelopmentPlan({
      system: developmentInstructions(kind, profile.locale),
      prompt: developmentPrompt({
        kind,
        today,
        answers: parsed.answers,
        occupation: profile.occupation,
        dailyMinutes: profile.dailyMinutes,
      }),
    })
    .catch(async (error: unknown) => {
      // Rien n'a été produit : la requête ne compte pas dans la limite du jour
      await releaseAiRequest(reservation.id).catch(() => {});
      throw error;
    });
  await recordAiUsage(reservation.id, result.usage);

  if (result.refused) return { ok: false, error: "refused" };
  if (result.crisis) return { ok: false, error: "crisis" };
  if (!result.plan) return { ok: false, error: "unexpected" };

  // La semaine type se répète d'aujourd'hui jusqu'à la date visée
  const period = planPeriod(
    today,
    parsed.answers.targetDate,
    result.plan.goal?.targetInDays ?? null,
  );
  const dates = {
    startsOn: toDbDate(period.startsOn),
    endsOn: toDbDate(period.endsOn),
  };
  await db.developmentPlan.upsert({
    where: { userId_kind: { userId, kind } },
    create: {
      userId,
      kind,
      answers: parsed.answers,
      plan: result.plan,
      ...dates,
    },
    update: { answers: parsed.answers, plan: result.plan, ...dates },
  });
  return { ok: true };
}

/** Supprime le plan et les réponses du questionnaire. */
export async function deletePlan(userId: string, kind: DevelopmentKind) {
  const { count } = await db.developmentPlan.deleteMany({
    where: { userId, kind },
  });
  return count > 0;
}

/**
 * Ajoute ce que l'utilisateur garde du plan : l'objectif, puis les habitudes
 * et tâches (liées à l'objectif s'il est ajouté). Seuls les éléments du plan
 * enregistré sont acceptés ; une fois ajoutés, ils en sont retirés (pas de
 * doublon en cas de double clic).
 */
export async function applyPlan(
  userId: string,
  kind: DevelopmentKind,
  selection: DevelopmentSelection,
) {
  const profile = await getAiProfile(userId);
  if (!profile) return false;
  const today = toCalendarDay(new Date(), profile.timeZone);
  const pillar = KIND_PILLAR[kind];

  return db.$transaction(
    async (tx) => {
      const row = await tx.developmentPlan.findUnique({
        where: { userId_kind: { userId, kind } },
        select: { id: true, plan: true, endsOn: true },
      });
      const stored = row ? storedPlanSchema.safeParse(row.plan) : null;
      if (!row || !stored?.success) return false;
      const plan = stored.data;

      const habitTitles = new Set(selection.habits.map((habit) => habit.title));
      const taskTitles = new Set(selection.tasks.map((task) => task.title));
      const habits = plan.habits.filter((habit) =>
        habitTitles.has(habit.title),
      );
      const tasks = plan.tasks.filter((task) => taskTitles.has(task.title));
      const addGoal = selection.goal && plan.goal !== null;
      if (!addGoal && habits.length === 0 && tasks.length === 0) return false;

      const goal =
        addGoal && plan.goal
          ? await tx.goal.create({
              data: {
                userId,
                title: plan.goal.title,
                pillar,
                // L'objectif tombe à la fin du plan dans le calendrier
                targetDate: row.endsOn,
                developmentPlanId: row.id,
              },
              select: { id: true },
            })
          : null;
      // Liés au plan : ils apparaissent dans son calendrier
      await tx.habit.createMany({
        data: habits.map((habit) => ({
          userId,
          goalId: goal?.id ?? null,
          developmentPlanId: row.id,
          title: habit.title,
          pillar,
          weekdays: [...habit.weekdays].sort((a, b) => a - b),
        })),
      });
      await tx.task.createMany({
        data: tasks.map((task) => ({
          userId,
          goalId: goal?.id ?? null,
          developmentPlanId: row.id,
          title: task.title,
          dueDate: toDbDate(addDays(today, task.dueInDays)),
        })),
      });

      const remaining: DevelopmentPlan = {
        ...plan,
        goal: addGoal ? null : plan.goal,
        habits: plan.habits.filter((habit) => !habitTitles.has(habit.title)),
        tasks: plan.tasks.filter((task) => !taskTitles.has(task.title)),
      };
      await tx.developmentPlan.update({
        where: { id: row.id },
        data: { plan: remaining },
      });
      return true;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

/**
 * Tout ce que la page d'un plan doit savoir : Get iT AI configuré et accepté,
 * le plan enregistré, et demain (première date permise dans le questionnaire).
 */
export async function getPlanPage(userId: string, kind: DevelopmentKind) {
  const [profile, stored] = await Promise.all([
    getAiProfile(userId),
    getPlan(userId, kind),
  ]);
  const today = toCalendarDay(
    new Date(),
    profile?.timeZone ?? "America/Toronto",
  );
  return {
    configured: getAiProvider() !== null,
    consented: profile?.consented ?? false,
    stored,
    minDate: addDays(today, 1),
  };
}

/** Réponses précédentes, pour refaire un plan sans tout ressaisir. */
export async function getAnswers(userId: string, kind: DevelopmentKind) {
  const row = await db.developmentPlan.findUnique({
    where: { userId_kind: { userId, kind } },
    select: { answers: true },
  });
  return (row?.answers as Answers | undefined) ?? null;
}

/**
 * Un mois du calendrier : les plans (tous, ou celui d'un type) et ce qui
 * tombe dans le mois. Pour un plan, seuls les objectifs, habitudes et tâches
 * ajoutés depuis ce plan ; pour le calendrier principal, tout.
 */
export async function getCalendar(
  userId: string,
  scope: DevelopmentKind | "all",
  /** Mois voulu ; le mois en cours par défaut. */
  requested?: Month,
): Promise<CalendarData> {
  const timeZone = await getUserTimeZone(userId);
  const today = toCalendarDay(new Date(), timeZone);
  const month = requested ?? monthOf(today);
  const { first, last } = monthRange(month);
  const range = { gte: toDbDate(first), lte: toDbDate(last) };

  const planRows = await db.developmentPlan.findMany({
    where: { userId, kind: scope === "all" ? undefined : scope },
    select: { id: true, kind: true, plan: true, startsOn: true, endsOn: true },
  });
  const plans = planRows.flatMap((row) => {
    const plan = storedPlanSchema.safeParse(row.plan);
    return plan.success
      ? [
          {
            id: row.id,
            kind: row.kind,
            title: plan.data.title,
            startsOn: fromDbDate(row.startsOn),
            endsOn: fromDbDate(row.endsOn),
            schedule: plan.data.schedule,
          },
        ]
      : [];
  });
  const empty = { month, today, plans, tasks: [], habits: [], goals: [] };
  // Le calendrier d'un plan qui n'existe pas encore est vide
  const planId = scope === "all" ? undefined : plans[0]?.id;
  if (scope !== "all" && !planId) return empty;
  const kindById = new Map(planRows.map((row) => [row.id, row.kind]));
  const planKind = (id: string | null) =>
    id ? (kindById.get(id) ?? null) : null;

  const [tasks, habits, goals] = await Promise.all([
    db.task.findMany({
      where: { userId, dueDate: range, developmentPlanId: planId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: {
        id: true,
        title: true,
        dueDate: true,
        completedAt: true,
        developmentPlanId: true,
      },
    }),
    db.habit.findMany({
      where: {
        userId,
        developmentPlanId: planId,
        OR: [{ archivedAt: null }, { archivedAt: { gte: toDbDate(first) } }],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        weekdays: true,
        createdAt: true,
        archivedAt: true,
        developmentPlanId: true,
        completions: { where: { day: range }, select: { day: true } },
      },
    }),
    db.goal.findMany({
      where: {
        userId,
        targetDate: range,
        status: { not: "archived" },
        developmentPlanId: planId,
      },
      select: {
        id: true,
        title: true,
        targetDate: true,
        status: true,
        developmentPlanId: true,
      },
    }),
  ]);

  return {
    ...empty,
    tasks: tasks.flatMap((task) =>
      task.dueDate
        ? [
            {
              id: task.id,
              title: task.title,
              dueDate: fromDbDate(task.dueDate),
              done: task.completedAt !== null,
              planKind: planKind(task.developmentPlanId),
            },
          ]
        : [],
    ),
    habits: habits
      .map((habit) => ({
        id: habit.id,
        title: habit.title,
        weekdays: habit.weekdays,
        from: toCalendarDay(habit.createdAt, timeZone),
        until: habit.archivedAt
          ? toCalendarDay(habit.archivedAt, timeZone)
          : null,
        doneDays: habit.completions.map((completion) =>
          fromDbDate(completion.day),
        ),
        planKind: planKind(habit.developmentPlanId),
      }))
      .filter((habit) => habit.from <= last),
    goals: goals.flatMap((goal) =>
      goal.targetDate
        ? [
            {
              id: goal.id,
              title: goal.title,
              targetDate: fromDbDate(goal.targetDate),
              done: goal.status === "completed",
              planKind: planKind(goal.developmentPlanId),
            },
          ]
        : [],
    ),
  };
}
