import { z } from 'zod';
import { RATE_METHODS, fvAnnuityFactor, periodRate } from './rates';
import { collect, unrealisticReturn, type Warning } from './common';

export const fireInputSchema = z
  .object({
    currentAge: z.number().min(15).max(80),
    retirementAge: z.number().min(16).max(90),
    annualExpenses: z.number().min(1).max(1e11),
    inflationPct: z.number().min(0).max(30),
    safeWithdrawalPct: z.number().min(0.5).max(15),
    currentSavings: z.number().min(0).max(1e12),
    monthlyInvestment: z.number().min(0).max(1e9),
    stepUpPct: z.number().min(0).max(50),
    annualReturn: z.number().min(0).max(50),
    rateMethod: z.enum(RATE_METHODS),
  })
  .refine((v) => v.retirementAge > v.currentAge, { path: ['retirementAge'], message: 'retirementAfterCurrent' });
export type FireInput = z.infer<typeof fireInputSchema>;

export const fireDefaults: FireInput = {
  currentAge: 30,
  retirementAge: 45,
  annualExpenses: 600_000,
  inflationPct: 6,
  safeWithdrawalPct: 3.5,
  currentSavings: 1_000_000,
  monthlyInvestment: 50_000,
  stepUpPct: 5,
  annualReturn: 11,
  rateMethod: 'effective',
};

export interface FireRow {
  year: number;
  age: number;
  corpus: number;
  target: number;
}

export interface FireResult {
  yearsToRetire: number;
  expensesAtRetirement: number;
  /** corpus needed at the chosen retirement age */
  fireCorpus: number;
  /** projected corpus at the chosen retirement age */
  projectedCorpus: number;
  gap: number;
  onTrack: boolean;
  /** extra flat monthly SIP needed (on top of the plan) to reach the corpus on time */
  extraMonthlyNeeded: number;
  /** earliest age at which savings reach the (inflating) target, null if not within 70 years */
  fireAge: number | null;
  yearly: FireRow[];
  warnings: Warning[];
}

export function calculateFire(input: FireInput): FireResult {
  const i = periodRate(input.annualReturn, 12, input.rateMethod);
  const inf = input.inflationPct / 100;
  const swr = input.safeWithdrawalPct / 100;
  const yearsToRetire = input.retirementAge - input.currentAge;
  const expensesAtRetirement = input.annualExpenses * Math.pow(1 + inf, yearsToRetire);
  const fireCorpus = expensesAtRetirement / swr;

  let balance = input.currentSavings;
  const yearly: FireRow[] = [];
  let projectedCorpus = input.currentSavings;
  let fireAge: number | null = null;
  const horizon = Math.max(yearsToRetire, 70);
  for (let y = 1; y <= horizon; y++) {
    const amount = input.monthlyInvestment * Math.pow(1 + input.stepUpPct / 100, y - 1);
    for (let m = 0; m < 12; m++) balance = (balance + amount) * (1 + i);
    const target = (input.annualExpenses * Math.pow(1 + inf, y)) / swr;
    if (y <= yearsToRetire) {
      yearly.push({ year: y, age: input.currentAge + y, corpus: balance, target });
      projectedCorpus = balance;
    }
    if (fireAge === null && balance >= target) fireAge = input.currentAge + y;
    if (y >= yearsToRetire && fireAge !== null) break;
  }
  const gap = Math.max(0, fireCorpus - projectedCorpus);
  const n = yearsToRetire * 12;
  const extraMonthlyNeeded = gap / (fvAnnuityFactor(i, n) * (1 + i));
  return {
    yearsToRetire,
    expensesAtRetirement,
    fireCorpus,
    projectedCorpus,
    gap,
    onTrack: gap === 0,
    extraMonthlyNeeded,
    fireAge,
    yearly,
    warnings: collect(
      unrealisticReturn(input.annualReturn),
      input.safeWithdrawalPct > 5 && { code: 'highWithdrawalRate', params: { rate: input.safeWithdrawalPct } },
      fireAge === null && { code: 'fireNotReached' },
    ),
  };
}
