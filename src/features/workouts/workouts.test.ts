import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addSet,
  afterSync,
  applyWeight,
  buildExercises,
  changeSet,
  changeWeight,
  hasActivity,
  hasPending,
  mergeStored,
  removeLastSet,
  setsOf,
  startDraft,
  syncPayload,
} from "./draft";
import {
  bestSet,
  findRecords,
  formatElapsed,
  fromDisplayWeight,
  historyFromRows,
  isLoaded,
  parsePrescription,
  parseWeightText,
  prefillSets,
  suggestWeight,
  toDisplayWeight,
  weightFieldText,
  workoutMinutes,
  workoutSyncSchema,
  workoutTotals,
  WORKOUT_LIMITS,
  type ExerciseHistory,
  type SetLog,
} from "./rules";

describe("parsePrescription", () => {
  it("lit les séries, les répétitions et le repos", () => {
    expect(parsePrescription("4 × 8, repos 90 s")).toMatchObject({
      sets: 4,
      repsMin: 8,
      repsMax: 8,
      seconds: null,
      restSeconds: 90,
      perSide: false,
    });
    expect(
      parsePrescription("3 × 10 à 12, repos 60 s, descente contrôlée"),
    ).toMatchObject({ sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60 });
    expect(parsePrescription("4 x 8-10, rest 90 s, slow")).toMatchObject({
      sets: 4,
      repsMin: 8,
      repsMax: 10,
      restSeconds: 90,
    });
    expect(parsePrescription("3 × 8 par jambe, repos 2 min")).toMatchObject({
      sets: 3,
      repsMax: 8,
      restSeconds: 120,
      perSide: true,
    });
    expect(parsePrescription("3 × 8 , repos 1 min 30").restSeconds).toBe(90);
  });

  it("lit un exercice chronométré ou un bloc de temps", () => {
    expect(parsePrescription("3 × 40 s, repos 45 s")).toMatchObject({
      sets: 3,
      seconds: 40,
      repsMax: null,
      restSeconds: 45,
    });
    expect(parsePrescription("3 x 1 min")).toMatchObject({ seconds: 60 });
    expect(parsePrescription("5 min de marche")).toMatchObject({
      sets: 1,
      seconds: 300,
    });
  });

  it("lit les séries et répétitions écrites en toutes lettres", () => {
    expect(parsePrescription("3 séries de 12 répétitions")).toMatchObject({
      sets: 3,
      repsMin: 12,
      repsMax: 12,
    });
  });

  it("sans format reconnu : 3 séries, sans objectif", () => {
    expect(parsePrescription("Bien contrôler le mouvement")).toEqual({
      sets: 3,
      repsMin: null,
      repsMax: null,
      seconds: null,
      restSeconds: null,
      perSide: false,
    });
    // Le repos n'est jamais pris pour des répétitions
    expect(parsePrescription("repos 90 s")).toMatchObject({
      sets: 3,
      seconds: null,
      restSeconds: 90,
    });
    expect(parsePrescription("50 × 8").sets).toBe(WORKOUT_LIMITS.sets);
  });
});

describe("unités", () => {
  it("kg et lb reviennent à la même valeur", () => {
    for (const value of [45, 47.5, 135, 2.5]) {
      expect(toDisplayWeight(fromDisplayWeight(value, "lb"), "lb")).toBe(value);
      expect(toDisplayWeight(fromDisplayWeight(value, "kg"), "kg")).toBe(value);
    }
  });

  it("lit ce qui est tapé, avec la virgule ou le point", () => {
    expect(parseWeightText("22,5", "kg")).toBe(22_500);
    expect(parseWeightText("22.5", "kg")).toBe(22_500);
    expect(parseWeightText("", "kg")).toBeNull();
    expect(parseWeightText("abc", "kg")).toBeNull();
    expect(parseWeightText("9999", "kg")).toBeNull();
    expect(weightFieldText(22_500, "kg", "fr")).toBe("22,5");
    expect(weightFieldText(22_500, "kg", "en")).toBe("22.5");
    expect(weightFieldText(null, "kg", "fr")).toBe("");
  });

  it("le poids du corps et les élastiques n'ont pas de poids à noter", () => {
    expect(isLoaded(["equipment:bodyweight", "muscle:chest"])).toBe(false);
    expect(isLoaded(["equipment:bands"])).toBe(false);
    expect(isLoaded(["equipment:bodyweight", "equipment:dumbbells"])).toBe(
      true,
    );
    expect(isLoaded(["muscle:chest"])).toBe(true);
    // Un exercice écrit à la main : le champ reste, il peut rester vide
    expect(isLoaded(null)).toBe(true);
  });
});

const history = (
  sets: { weightGrams: number | null; reps: number | null }[],
): ExerciseHistory => ({
  loaded: true,
  last: {
    day: "2026-10-26",
    sets: sets.map((set, index) => ({
      ...set,
      seconds: null,
      setNumber: index + 1,
    })),
  },
  best: null,
});

describe("préremplissage et suggestion", () => {
  const plan = parsePrescription("3 × 10 à 12, repos 60 s");

  it("reprend le poids de la dernière fois et les répétitions visées", () => {
    expect(prefillSets(parsePrescription("2 × 8"), null)).toEqual([
      { setNumber: 1, weightGrams: null, reps: 8, seconds: null },
      { setNumber: 2, weightGrams: null, reps: 8, seconds: null },
    ]);
    const filled = prefillSets(
      plan,
      history([
        { weightGrams: 20_000, reps: 11 },
        { weightGrams: 20_000, reps: 9 },
      ]),
    );
    expect(filled.map((set) => set.weightGrams)).toEqual([
      20_000, 20_000, 20_000,
    ]);
    // Dans la fourchette : là où on en était ; sous la fourchette : son bas
    expect(filled.map((set) => set.reps)).toEqual([11, 10, 10]);
    expect(
      prefillSets(parsePrescription("3 × 40 s"), null).map(
        (set) => set.seconds,
      ),
    ).toEqual([40, 40, 40]);
  });

  it("pas de poids pour un exercice au poids du corps", () => {
    const filled = prefillSets(parsePrescription("2 × 8"), {
      ...history([{ weightGrams: 5000, reps: 8 }]),
      loaded: false,
    });
    expect(filled[0]?.weightGrams).toBeNull();
  });

  it("suggère plus lourd seulement si toutes les séries ont atteint le haut de la fourchette", () => {
    const success = history([
      { weightGrams: 20_000, reps: 12 },
      { weightGrams: 20_000, reps: 12 },
      { weightGrams: 20_000, reps: 13 },
    ]);
    expect(suggestWeight(plan, success, "kg")).toBe(22_500);
    expect(
      toDisplayWeight(
        suggestWeight(
          plan,
          history([
            { weightGrams: fromDisplayWeight(45, "lb"), reps: 12 },
            { weightGrams: fromDisplayWeight(45, "lb"), reps: 12 },
            { weightGrams: fromDisplayWeight(45, "lb"), reps: 12 },
          ]),
          "lb",
        ) ?? 0,
        "lb",
      ),
    ).toBe(50);
    // Une série sous l'objectif, ou une série manquante : pas de suggestion
    expect(
      suggestWeight(
        plan,
        history([
          { weightGrams: 20_000, reps: 12 },
          { weightGrams: 20_000, reps: 12 },
          { weightGrams: 20_000, reps: 10 },
        ]),
        "kg",
      ),
    ).toBeNull();
    expect(
      suggestWeight(plan, history([{ weightGrams: 20_000, reps: 12 }]), "kg"),
    ).toBeNull();
    expect(suggestWeight(plan, null, "kg")).toBeNull();
    // Au poids du corps ou sans objectif : rien à suggérer
    expect(
      suggestWeight(
        parsePrescription("1 × 8"),
        history([{ weightGrams: null, reps: 8 }]),
        "kg",
      ),
    ).toBeNull();
    expect(
      suggestWeight(
        parsePrescription("Bien contrôler"),
        history([
          { weightGrams: 20_000, reps: 12 },
          { weightGrams: 20_000, reps: 12 },
          { weightGrams: 20_000, reps: 12 },
        ]),
        "kg",
      ),
    ).toBeNull();
  });
});

const set = (
  position: number,
  setNumber: number,
  weightGrams: number | null,
  reps: number | null,
  done = true,
): SetLog => ({ position, setNumber, weightGrams, reps, seconds: null, done });

describe("résumé de la séance", () => {
  it("compte les séries faites et le volume", () => {
    expect(
      workoutTotals(
        [3, 2],
        [
          set(0, 1, 20_000, 10),
          set(0, 2, 20_000, 8),
          set(0, 3, 20_000, 8, false),
          set(1, 1, null, 12),
          set(1, 2, null, 12),
          set(1, 3, null, 10),
        ],
      ),
    ).toEqual({ doneSets: 5, totalSets: 6, volumeGrams: 360_000 });
  });

  it("un record bat l'ancien ; la première fois n'en est pas un", () => {
    const sets = [
      set(0, 1, 62_500, 8),
      set(0, 2, 62_500, 6),
      set(1, 1, 10_000, 12),
      set(2, 1, null, 25),
      set(3, 1, 100_000, 5, false),
    ];
    expect(
      findRecords(
        [
          {
            position: 0,
            name: "Développé couché",
            previousBest: { weightGrams: 60_000, reps: 8, seconds: null },
          },
          { position: 1, name: "Première fois", previousBest: null },
          {
            position: 2,
            name: "Pompes",
            previousBest: { weightGrams: null, reps: 25, seconds: null },
          },
          {
            position: 3,
            name: "Pas faite",
            previousBest: { weightGrams: 1000, reps: 1, seconds: null },
          },
        ],
        sets,
      ),
    ).toEqual([
      {
        exercise: "Développé couché",
        weightGrams: 62_500,
        reps: 8,
        seconds: null,
      },
    ]);
    expect(
      bestSet([
        set(0, 1, 20_000, 8),
        set(0, 2, 20_000, 10),
        set(0, 3, 15_000, 20),
      ]),
    ).toEqual({ weightGrams: 20_000, reps: 10, seconds: null });
  });

  it("l'historique : la dernière séance et le meilleur résultat", () => {
    const rows = [
      {
        sessionId: "b",
        day: "2026-11-02",
        setNumber: 1,
        weightGrams: 20_000,
        reps: 8,
        seconds: null,
      },
      {
        sessionId: "b",
        day: "2026-11-02",
        setNumber: 2,
        weightGrams: 20_000,
        reps: 7,
        seconds: null,
      },
      {
        sessionId: "a",
        day: "2026-10-26",
        setNumber: 1,
        weightGrams: 22_500,
        reps: 5,
        seconds: null,
      },
    ];
    const result = historyFromRows(rows);
    expect(result.last?.day).toBe("2026-11-02");
    expect(result.last?.sets.map((entry) => entry.reps)).toEqual([8, 7]);
    expect(result.best).toEqual({
      weightGrams: 22_500,
      reps: 5,
      seconds: null,
    });
    expect(historyFromRows([])).toEqual({ last: null, best: null });
  });

  it("le temps", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(754)).toBe("12:34");
    expect(formatElapsed(3723)).toBe("1:02:03");
    expect(
      workoutMinutes("2026-11-02T10:00:00.000Z", "2026-11-02T10:52:10.000Z"),
    ).toBe(52);
    expect(
      workoutMinutes("2026-11-02T10:00:00.000Z", "2026-11-02T10:00:05.000Z"),
    ).toBe(1);
  });
});

describe("brouillon de séance", () => {
  const exercises = buildExercises(
    [
      { name: "Développé", detail: "2 × 8, repos 90 s", ref: "id-1" },
      { name: "Pompes", detail: "1 × 10", ref: null },
    ],
    { "id-1": history([{ weightGrams: 40_000, reps: 8 }]) },
  );
  const fresh = () =>
    startDraft({
      day: "2026-11-02",
      weekday: 1,
      now: "2026-11-02T10:00:00.000Z",
      exercises,
      saved: null,
    });

  it("commence prérempli, sans rien à envoyer", () => {
    const draft = fresh();
    expect(draft.sets).toHaveLength(3);
    expect(setsOf(draft, 0).map((entry) => entry.weightGrams)).toEqual([
      40_000, 40_000,
    ]);
    expect(hasPending(draft)).toBe(false);
    expect(hasActivity(draft)).toBe(false);
  });

  it("un ✓ part au prochain envoi, et ce qui change entre-temps reste à envoyer", () => {
    let draft = changeSet(fresh(), "0:1", { done: true });
    expect(hasActivity(draft)).toBe(true);
    const payload = syncPayload(draft);
    expect(payload.sets).toEqual([
      {
        position: 0,
        setNumber: 1,
        weightGrams: 40_000,
        reps: 8,
        seconds: null,
        done: true,
      },
    ]);
    expect(workoutSyncSchema.safeParse(payload).success).toBe(true);
    // Le poids change pendant l'envoi : il reste à envoyer
    draft = changeSet(draft, "0:1", { weightGrams: 42_500 });
    draft = afterSync(draft, payload);
    expect(draft.dirty).toEqual(["0:1"]);
    draft = afterSync(draft, syncPayload(draft));
    expect(hasPending(draft)).toBe(false);
  });

  it("ajoute et retire une série", () => {
    let draft = addSet(fresh(), 1);
    expect(setsOf(draft, 1).map((entry) => entry.reps)).toEqual([10, 10]);
    expect(draft.dirty).toEqual(["1:2"]);
    draft = removeLastSet(draft, 1);
    expect(setsOf(draft, 1)).toHaveLength(1);
    expect(draft.dirty).toEqual([]);
    expect(draft.removed).toEqual([{ position: 1, setNumber: 2 }]);
    // Il reste toujours une série, et une série faite ne se retire pas
    expect(removeLastSet(draft, 1)).toBe(draft);
    const done = changeSet(fresh(), "0:2", { done: true });
    expect(removeLastSet(done, 0)).toBe(done);
    // 10 séries au plus
    let full = fresh();
    for (let index = 0; index < 20; index++) full = addSet(full, 1);
    expect(setsOf(full, 1)).toHaveLength(WORKOUT_LIMITS.sets);
  });

  it("reprend une séance : le serveur, puis ce qui n'a pas été envoyé", () => {
    const saved = {
      startedAt: "2026-11-02T09:00:00.000Z",
      sets: [set(0, 1, 45_000, 8)],
    };
    const base = startDraft({
      day: "2026-11-02",
      weekday: 1,
      now: "2026-11-02T10:00:00.000Z",
      exercises,
      saved,
    });
    expect(base.startedAt).toBe(saved.startedAt);
    // Une série enregistrée garde ses valeurs ; celles pas encore touchées restent à faire
    expect(setsOf(base, 0).map((entry) => entry.weightGrams)).toEqual([
      45_000, 40_000,
    ]);
    expect(setsOf(base, 0).map((entry) => entry.done)).toEqual([true, false]);
    expect(setsOf(base, 1)).toHaveLength(1);

    const stored = changeSet(base, "0:2", { reps: 6, done: true });
    const merged = mergeStored(base, stored);
    expect(setsOf(merged, 0).map((entry) => entry.reps)).toEqual([8, 6]);
    expect(merged.dirty).toEqual(["0:2"]);
    expect(mergeStored(base, null)).toBe(base);

    // Une série retirée sur le téléphone ne revient pas
    const afterRemoval = removeLastSet(base, 0);
    expect(setsOf(mergeStored(base, afterRemoval), 0)).toHaveLength(1);
  });

  it("le poids suit dans les séries suivantes, sans toucher une pyramide", () => {
    let draft = changeWeight(fresh(), "0:1", 42_500);
    expect(setsOf(draft, 0).map((entry) => entry.weightGrams)).toEqual([
      42_500, 42_500,
    ]);
    expect(draft.dirty).toEqual(["0:1", "0:2"]);
    // La deuxième a son propre poids : changer la première ne la touche plus
    draft = changeWeight(draft, "0:2", 45_000);
    draft = changeWeight(draft, "0:1", 40_000);
    expect(setsOf(draft, 0).map((entry) => entry.weightGrams)).toEqual([
      40_000, 45_000,
    ]);
    // Une série déjà faite ne change pas
    const done = changeSet(fresh(), "0:2", { done: true });
    expect(
      setsOf(changeWeight(done, "0:1", 50_000), 0).map(
        (entry) => entry.weightGrams,
      ),
    ).toEqual([50_000, 40_000]);
    expect(changeWeight(fresh(), "9:9", 1)).toEqual(fresh());
  });

  it("la suggestion s'applique aux séries pas encore faites", () => {
    const done = changeSet(fresh(), "0:1", { done: true });
    expect(
      setsOf(applyWeight(done, 0, 42_500), 0).map((entry) => entry.weightGrams),
    ).toEqual([40_000, 42_500]);
  });

  it("« Terminer » est gardé jusqu'à ce que le serveur l'ait reçu", () => {
    const draft = {
      ...changeSet(fresh(), "0:1", { done: true }),
      finish: { finishedAt: "2026-11-02T11:00:00.000Z", feeling: 3 },
    };
    const payload = syncPayload(draft);
    expect(payload.finish?.feeling).toBe(3);
    expect(afterSync(draft, payload).finish).toBeNull();
    expect(
      afterSync(draft, { ...payload, finish: null, sets: [] }).finish,
    ).not.toBeNull();
  });
});

describe("migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20261116120000_workouts/migration.sql",
    ),
    "utf8",
  );

  it("garde les mêmes limites que les règles", () => {
    expect(sql).toContain(
      `"position" BETWEEN 0 AND ${WORKOUT_LIMITS.exercises - 1}`,
    );
    expect(sql).toContain(`"set_number" BETWEEN 1 AND ${WORKOUT_LIMITS.sets}`);
    expect(sql).toContain(
      `"weight_grams" BETWEEN 0 AND ${WORKOUT_LIMITS.weightGrams}`,
    );
    expect(sql).toContain(`"reps" BETWEEN 0 AND ${WORKOUT_LIMITS.reps}`);
    expect(sql).toContain(`"seconds" BETWEEN 0 AND ${WORKOUT_LIMITS.seconds}`);
    expect(sql).toContain(
      `char_length("title") BETWEEN 1 AND ${WORKOUT_LIMITS.title}`,
    );
    expect(sql).toContain("\"weight_unit\" IN ('kg', 'lb')");
    expect(sql).toContain('"workout_sessions" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('"workout_sets" ENABLE ROW LEVEL SECURITY');
  });
});
