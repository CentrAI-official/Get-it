import type { Pillar } from "@/config/pillars";
import type { OnboardingDraft } from "../schemas";

export type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export type PillarsStepProps = StepProps & {
  setPillars: (pillars: Pillar[]) => void;
};
