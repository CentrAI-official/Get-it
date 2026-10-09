import { z } from "zod";

/** Ce que mesure le check-in quotidien, chacun noté de 1 à 5 (§29). */
export const CHECK_IN_METRICS = ["mood", "energy", "stress", "sleep"] as const;
export type CheckInMetric = (typeof CHECK_IN_METRICS)[number];
export type CheckInScores = Record<CheckInMetric, number>;

const score = z.coerce.number().int().min(1).max(5);

export const checkInSchema = z.object({
  mood: score,
  energy: score,
  stress: score,
  sleep: score,
});

export type CheckInState = {
  status: "idle" | "success" | "error";
  error?: "incomplete" | "unexpected";
};
