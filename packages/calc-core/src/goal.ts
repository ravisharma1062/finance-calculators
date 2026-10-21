import { z } from 'zod';
import { RATE_METHODS, fvAnnuityFactor, periodRate } from './rates';
import { collect, unrealisticReturn, type Warning } from './common';

export const goalInputSchema = z.object({
  goalAmountToday: z.number().min(1).max(1e12),
  years: z.number().min(1).max(60),
  goalInflationPct: z.number().min(0).max(30),
  annualReturn: z.number().min(0).max(50),
  existingSavings: z.number().min(0).max(1e12),
  rateMethod: z.enum(RATE_METHODS),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const goalDefaults: GoalInput = {
  goalAmountToday: 2_500_000,
  years: 10,
  goalInflationPct: 6,
  annualReturn: 12,
  existingSavings: 0,
  rateMethod: 'effective',
};

export interface GoalResult {
  goalAmountFuture: number;
  existingSavingsFuture: number;
  shortfall: number;
  /** monthly SIP (invested at the start of each month) needed to close the shortfall */
  requiredMonthlySip: number;
  /** one-time amount needed today to close the shortfall */
  requiredLumpsum: number;
  totalSipInvested: number;
  warnings: Warning[];
}

export function calculateGoal(input: GoalInput): GoalResult {
  const growthYears = Math.pow(1 + input.annualReturn / 100, input.years);
  const goalAmountFuture = input.goalAmountToday * Math.pow(1 + input.goalInflationPct / 100, input.years);
  const existingSavingsFuture = input.existingSavings * growthYears;
  const shortfall = Math.max(0, goalAmountFuture - existingSavingsFuture);
  const n = Math.round(input.years * 12);
  const i = periodRate(input.annualReturn, 12, input.rateMethod);
  const factor = fvAnnuityFactor(i, n) * (1 + i);
  const requiredMonthlySip = shortfall / factor;
  return {
    goalAmountFuture,
    existingSavingsFuture,
    shortfall,
    requiredMonthlySip,
    requiredLumpsum: shortfall / growthYears,
    totalSipInvested: requiredMonthlySip * n,
    warnings: collect(unrealisticReturn(input.annualReturn), shortfall === 0 && { code: 'goalAlreadyMet' }),
  };
}
