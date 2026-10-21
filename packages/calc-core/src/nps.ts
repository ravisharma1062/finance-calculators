import { z } from 'zod';
import { RATE_METHODS, periodRate } from './rates';
import { collect, unrealisticReturn, yearRows, type FlowStep, type Warning, type YearRow } from './common';

export const npsInputSchema = z
  .object({
    monthlyContribution: z.number().min(0).max(1e9),
    currentAge: z.number().min(18).max(70),
    retirementAge: z.number().min(19).max(80),
    annualReturn: z.number().min(0).max(30),
    rateMethod: z.enum(RATE_METHODS),
    stepUpPct: z.number().min(0).max(50),
    /** share of the corpus used to buy an annuity */
    annuityPct: z.number().min(0).max(100),
    annuityRate: z.number().min(0).max(20),
    /** smallest allowed annuity share (rule data, set from country config) */
    minAnnuityPct: z.number().min(0).max(100),
  })
  .refine((v) => v.retirementAge > v.currentAge, { path: ['retirementAge'], message: 'retirementAfterCurrent' });
export type NpsInput = z.infer<typeof npsInputSchema>;

export const npsDefaults: NpsInput = {
  monthlyContribution: 10_000,
  currentAge: 30,
  retirementAge: 60,
  annualReturn: 10,
  rateMethod: 'effective',
  stepUpPct: 0,
  annuityPct: 40,
  annuityRate: 6,
  minAnnuityPct: 40,
};

export interface NpsResult {
  invested: number;
  corpus: number;
  returns: number;
  lumpSum: number;
  annuityCorpus: number;
  monthlyPension: number;
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculateNps(input: NpsInput): NpsResult {
  const months = (input.retirementAge - input.currentAge) * 12;
  const i = periodRate(input.annualReturn, 12, input.rateMethod);
  const steps: FlowStep[] = [];
  let balance = 0;
  for (let k = 0; k < months; k++) {
    const amount = input.monthlyContribution * Math.pow(1 + input.stepUpPct / 100, Math.floor(k / 12));
    const opening = balance;
    const returns = opening * i;
    balance = opening + returns + amount;
    steps.push({ opening, flow: amount, returns, closing: balance });
  }
  const invested = steps.reduce((s, x) => s + x.flow, 0);
  const annuityCorpus = (balance * input.annuityPct) / 100;
  return {
    invested,
    corpus: balance,
    returns: balance - invested,
    lumpSum: balance - annuityCorpus,
    annuityCorpus,
    monthlyPension: (annuityCorpus * input.annuityRate) / 100 / 12,
    yearly: yearRows(steps, 12),
    warnings: collect(
      unrealisticReturn(input.annualReturn),
      input.annuityPct < input.minAnnuityPct && { code: 'annuityBelowMinimum', params: { min: input.minAnnuityPct } },
    ),
  };
}
