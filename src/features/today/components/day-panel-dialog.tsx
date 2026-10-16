"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { DayPlan } from "@/server/day/service";
import { markDayPanelSeenAction } from "../actions";
import { summarizePlannedDay } from "../day-plan";
import {
  closeDayPanel,
  openDayPanel,
  setDayProgress,
  useDayPanel,
} from "../day-panel-store";
import { NEW_TASK_ANCHOR } from "../new-task";
import { DayBoard } from "./day-board";

type DayPanelDialogProps = {
  plan: DayPlan;
  /** Première visite du jour : s'ouvre tout seul. */
  autoOpen: boolean;
  stamp: string;
  greeting: string;
  initial: string;
};

/** Popup « Ma journée » : s'ouvre une fois par jour, puis depuis ses boutons. */
export function DayPanelDialog({
  plan,
  autoOpen,
  stamp,
  greeting,
  initial,
}: DayPanelDialogProps) {
  const t = useTranslations("Today.panel");
  const { open, focusNewTask } = useDayPanel();
  const contentRef = useRef<HTMLDivElement>(null);

  // Avancement enregistré, affiché sur les boutons d'ouverture
  const progress = useMemo(() => summarizePlannedDay(plan).day, [plan]);
  useEffect(() => {
    setDayProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (!autoOpen) return;
    openDayPanel();
    void markDayPanelSeenAction();
  }, [autoOpen]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? openDayPanel() : closeDayPanel())}
    >
      <DialogContent
        ref={contentRef}
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-5 sm:max-w-2xl sm:p-6"
        onOpenAutoFocus={(event) => {
          if (!focusNewTask) return;
          // Menu « + » → « Nouvelle tâche » : le curseur va dans le formulaire
          const input = contentRef.current?.querySelector<HTMLInputElement>(
            `#${NEW_TASK_ANCHOR} input[name="title"]`,
          );
          if (!input) return;
          event.preventDefault();
          input.focus();
        }}
        onClickCapture={(event) => {
          // Un lien mène ailleurs : le popup se ferme
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            closeDayPanel();
          }
        }}
      >
        <DayBoard
          plan={plan}
          stamp={stamp}
          greeting={greeting}
          initial={initial}
        />
      </DialogContent>
    </Dialog>
  );
}
