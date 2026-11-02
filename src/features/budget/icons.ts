import {
  Banknote,
  Car,
  CircleEllipsis,
  CreditCard,
  HeartPulse,
  House,
  PiggyBank,
  Repeat,
  ShoppingCart,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { BudgetCategory } from "./rules";

/** Icône de chaque catégorie de dépense (et des revenus). */
export const CATEGORY_ICONS: Record<BudgetCategory, LucideIcon> = {
  housing: House,
  groceries: ShoppingCart,
  transport: Car,
  restaurants: UtensilsCrossed,
  leisure: Ticket,
  subscriptions: Repeat,
  health: HeartPulse,
  debt: CreditCard,
  savings: PiggyBank,
  other: CircleEllipsis,
};

export const INCOME_ICON = Banknote;
