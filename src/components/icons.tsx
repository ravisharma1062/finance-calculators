import {
  Banknote,
  Building2,
  BriefcaseBusiness,
  CalendarClock,
  CalendarX2,
  ChartNoAxesCombined,
  Flame,
  House,
  Landmark,
  Percent,
  PiggyBank,
  ShieldCheck,
  Target,
  TrendingUp,
  Umbrella,
  Vault,
  Wallet,
  Calculator,
  type LucideIcon,
} from 'lucide-react';

const map: Record<string, LucideIcon> = {
  Banknote,
  Building2,
  BriefcaseBusiness,
  CalendarClock,
  CalendarX2,
  ChartNoAxesCombined,
  Flame,
  House,
  Landmark,
  Percent,
  PiggyBank,
  ShieldCheck,
  Target,
  TrendingUp,
  Umbrella,
  Vault,
  Wallet,
};

export function CalcIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Calculator;
  return <Icon className={className} aria-hidden="true" />;
}
