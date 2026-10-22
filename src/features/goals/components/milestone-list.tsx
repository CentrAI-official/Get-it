"use client";

import { useTranslations } from "next-intl";
import {
  addMilestoneAction,
  deleteMilestoneAction,
  setMilestoneDoneAction,
} from "../actions";
import { AddItemForm, ChecklistItem } from "./checklist";

type MilestoneListProps = {
  goalId: string;
  milestones: { id: string; title: string; done: boolean }[];
};

export function MilestoneList({ goalId, milestones }: MilestoneListProps) {
  const t = useTranslations("Goals.milestones");

  return (
    <div className="flex flex-col gap-3">
      {milestones.length > 0 ? (
        <ol className="flex flex-col">
          {milestones.map((milestone) => (
            <ChecklistItem
              key={milestone.id}
              id={milestone.id}
              title={milestone.title}
              done={milestone.done}
              onToggle={(done) => setMilestoneDoneAction(milestone.id, done)}
              onDelete={() => deleteMilestoneAction(milestone.id)}
              deleteLabel={t("delete", { title: milestone.title })}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      <AddItemForm
        action={addMilestoneAction.bind(null, goalId)}
        label={t("addLabel")}
        placeholder={t("placeholder")}
        submitLabel={t("add")}
      />
    </div>
  );
}
