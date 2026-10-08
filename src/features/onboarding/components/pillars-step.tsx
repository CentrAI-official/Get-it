"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { PILLARS, pillarIcons } from "@/config/pillars";
import type { PillarsStepProps } from "./step-props";

export function PillarsStep({ draft, setPillars }: PillarsStepProps) {
  const t = useTranslations("Pillars");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PILLARS.map((pillar) => {
        const Icon = pillarIcons[pillar];
        const id = `pillar-${pillar}`;
        return (
          <FieldLabel key={pillar} htmlFor={id}>
            <Field orientation="horizontal">
              <Checkbox
                id={id}
                checked={draft.pillars.includes(pillar)}
                onCheckedChange={(checked) =>
                  // Garde l'ordre d'affichage des piliers
                  setPillars(
                    PILLARS.filter((item) =>
                      item === pillar
                        ? checked === true
                        : draft.pillars.includes(item),
                    ),
                  )
                }
              />
              <FieldContent>
                <FieldTitle>
                  <Icon aria-hidden="true" className="size-4 text-silver" />
                  {t(`${pillar}.name`)}
                </FieldTitle>
                <FieldDescription>
                  {t(`${pillar}.description`)}
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
        );
      })}
    </div>
  );
}
