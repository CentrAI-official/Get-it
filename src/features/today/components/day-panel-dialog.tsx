"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
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
  const { open } = useDayPanel();

  // Avancement enregistré, affiché sur le bouton d'ouverture du Profil
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
        closeLabel={t("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-5 sm:max-w-2xl sm:p-6"
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
