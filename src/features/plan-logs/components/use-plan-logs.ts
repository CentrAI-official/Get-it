"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  addPlanLogToBudgetAction,
  removePlanLogFromBudgetAction,
  savePlanLogAction,
} from "../actions";
import {
  applyLogChange,
  type LoggedKind,
  type PlanLogError,
  type PlanLogInput,
  type PlanLogRow,
} from "../rules";
import { reloadIfOutdated } from "@/lib/outdated";

/** Un élément de la séance affichée : où le noter, et son nom. */
export type LogTarget = {
  kind: LoggedKind;
  day: string;
  weekday: number;
  position: number;
  name: string;
};

type Change = Pick<PlanLogInput, "done" | "replacedBy" | "outcome">;
type PlanLogResult = Awaited<ReturnType<typeof savePlanLogAction>>;

/**
 * Les éléments cochés d'un plan : affichés tout de suite, puis confirmés par le
 * serveur (qui rafraîchit la page). En cas d'échec, l'élément revient à son état.
 */
export function usePlanLogs(initial: readonly PlanLogRow[]) {
  const [rows, addOptimistic] = useOptimistic(
    [...initial],
    (current: PlanLogRow[], change: PlanLogInput & { name: string }) =>
      applyLogChange(current, change),
  );
  const [error, setError] = useState<PlanLogError | null>(null);
  const [, startTransition] = useTransition();
  // À part : une coche en cours d'envoi ne doit pas bloquer « Ajouter au budget »
  const [budgetPending, startBudget] = useTransition();

  /** Sans réseau, l'action échoue : un message, jamais la page d'erreur. */
  async function run(action: () => Promise<PlanLogResult>) {
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
    } catch (error) {
      reloadIfOutdated(error);
      setError("unexpected");
    }
  }

  function save(target: LogTarget, change: Change) {
    setError(null);
    const { name, ...where } = target;
    const input = { ...where, ...change };
    startTransition(async () => {
      addOptimistic({ ...input, name });
      await run(() => savePlanLogAction(input));
    });
  }

  function addToBudget(target: LogTarget, amount: string) {
    setError(null);
    startBudget(() =>
      run(() =>
        addPlanLogToBudgetAction({
          kind: target.kind,
          day: target.day,
          weekday: target.weekday,
          position: target.position,
          amount,
        }),
      ),
    );
  }

  function removeFromBudget(target: LogTarget) {
    setError(null);
    startBudget(() =>
      run(() =>
        removePlanLogFromBudgetAction({
          kind: target.kind,
          day: target.day,
          weekday: target.weekday,
          position: target.position,
        }),
      ),
    );
  }

  return { rows, error, budgetPending, save, addToBudget, removeFromBudget };
}

export type PlanLogControls = ReturnType<typeof usePlanLogs>;
