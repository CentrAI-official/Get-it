import { UsersRound } from "lucide-react";
import { pillarIcons } from "@/config/pillars";
import { KIND_COLORS, NEUTRAL_COLORS } from "@/features/development/colors";
import { cn } from "@/lib/utils";
import type { GroupTopic } from "../rules";

/** Pastille d'un groupe : l'icône de son pilier, sur sa couleur (général : neutre). */
export function GroupBadge({
  topic,
  className,
}: {
  topic: GroupTopic;
  className?: string;
}) {
  const Icon = topic === "general" ? UsersRound : pillarIcons[topic];
  const colors = topic === "general" ? NEUTRAL_COLORS : KIND_COLORS[topic];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full",
        colors.tint,
        topic === "general" ? "text-silver" : colors.text,
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
