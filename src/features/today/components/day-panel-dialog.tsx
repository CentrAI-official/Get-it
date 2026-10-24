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
  name: string;
  avatarUrl: string | null;
};

/** Popup « Ma journée » : s'ouvre une fois par jour, puis depuis ses boutons. */
export function DayPanelDialog({
  plan,
  autoOpen,
  stamp,
  greeting,
  name,
  avatarUrl,
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
        // Plein écran sur téléphone (mode Focus), fenêtre haute sur ordinateur
        className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(52rem,calc(100dvh-4rem))] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 sm:ring-1"
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
          name={name}
          avatarUrl={avatarUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
