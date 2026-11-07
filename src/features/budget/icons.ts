import {
  ArrowLeftRight,
  Baby,
  Banknote,
  BookOpen,
  Car,
  CircleEllipsis,
  Coffee,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  HeartPulse,
  House,
  Landmark,
  LineChart,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Scale,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Ticket,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AccountType } from "./accounts";
import {
  isBuiltInCategory,
  type BuiltInCategory,
  type CategoryInfo,
  type CustomIcon,
} from "./categories";

/** Icône de chaque catégorie de Get iT. */
export const CATEGORY_ICONS: Record<BuiltInCategory, LucideIcon> = {
  housing: House,
  utilities: Zap,
  phone: Smartphone,
  groceries: ShoppingCart,
  transport: Car,
  insurance: Shield,
  health: HeartPulse,
  children: Baby,
  fees: Receipt,
  taxes: Landmark,
  restaurants: UtensilsCrossed,
  leisure: Ticket,
  subscriptions: Repeat,
  shopping: ShoppingBag,
  personal: Sparkles,
  travel: Plane,
  gifts: Gift,
  pets: PawPrint,
  education: GraduationCap,
  other: CircleEllipsis,
  savings: PiggyBank,
  debt: CreditCard,
};

/** Icônes au choix d'une catégorie personnelle. */
export const CUSTOM_ICON_MAP: Record<CustomIcon, LucideIcon> = {
  tag: Tag,
  star: Star,
  heart: Heart,
  dumbbell: Dumbbell,
  music: Music,
  gamepad: Gamepad2,
  book: BookOpen,
  wrench: Wrench,
  shirt: Shirt,
  baby: Baby,
  plane: Plane,
  coffee: Coffee,
};

export const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  chequing: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  investment: LineChart,
  property: House,
  credit: CreditCard,
  loan: HandCoins,
};

export const INCOME_ICON = Banknote;
export const TRANSFER_ICON = ArrowLeftRight;
export const ADJUSTMENT_ICON = Scale;

/** L'icône d'une catégorie, de Get iT ou personnelle. */
export function iconOfCategory(
  key: string | null,
  categories: readonly CategoryInfo[],
): LucideIcon {
  if (isBuiltInCategory(key)) return CATEGORY_ICONS[key];
  const icon = categories.find((entry) => entry.key === key)?.icon;
  return icon ? CUSTOM_ICON_MAP[icon] : CircleEllipsis;
}
