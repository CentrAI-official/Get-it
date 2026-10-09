"use client";

import { ListPlus, Plus, Repeat, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { focusNewTaskForm, NEW_TASK_ANCHOR } from "@/features/today/new-task";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type QuickAddProps = {
  /** `fab` : bouton rond au centre de la barre mobile ; `sidebar` : bouton pleine largeur. */
  variant: "fab" | "sidebar";
};

/** Bouton « + » (§61) : ajouter une tâche, une habitude ou un objectif. */
export function QuickAdd({ variant }: QuickAddProps) {
  const t = useTranslations("App.quickAdd");
  const router = useRouter();
  const addTask = useRef(false);
  const fab = variant === "fab";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={fab ? t("label") : undefined}
          className={cn(
            "flex items-center justify-center bg-primary text-primary-foreground transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
            fab
              ? "glow-primary mx-auto -mt-7 size-14 rounded-2xl"
              : "h-10 w-full gap-2 rounded-xl text-sm font-semibold hover:bg-primary/90",
          )}
        >
          <Plus
            aria-hidden="true"
            className={fab ? "size-6" : "size-4"}
            strokeWidth={2.5}
          />
          {!fab && t("label")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={fab ? "top" : "bottom"}
        align={fab ? "center" : "start"}
        sideOffset={fab ? 12 : 6}
        className="w-56"
        onCloseAutoFocus={(event) => {
          if (!addTask.current) return;
          addTask.current = false;
          // Menu fermé : le curseur va dans le formulaire plutôt que sur le bouton
          event.preventDefault();
          if (!focusNewTaskForm()) router.push(`/today#${NEW_TASK_ANCHOR}`);
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            addTask.current = true;
          }}
        >
          <ListPlus aria-hidden="true" />
          {t("task")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/habits/new">
            <Repeat aria-hidden="true" />
            {t("habit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/goals/new">
            <Target aria-hidden="true" />
            {t("goal")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
