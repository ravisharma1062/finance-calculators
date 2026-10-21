import { z } from 'zod';
import { RATE_METHODS, periodRate } from './rates';
import { collect, unrealisticReturn, yearRows, type FlowStep, type Warning, type YearRow } from './common';

export const sipInputSchema = z.object({
  monthlyInvestment: z.number().min(1).max(1e9),
  years: z.number().min(1).max(60),
  annualReturn: z.number().min(0).max(50),
  rateMethod: z.enum(RATE_METHODS),
  timing: z.enum(['start', 'end']),
  stepUpPct: z.number().min(0).max(50),
  inflationPct: z.number().min(0).max(30),
});
export type SipInput = z.infer<typeof sipInputSchema>;

export const sipDefaults: SipInput = {
  monthlyInvestment: 10_000,
  years: 15,
  annualReturn: 12,
  rateMethod: 'effective',
  timing: 'start',
  stepUpPct: 0,
  inflationPct: 0,
};

export interface SipResult {
  invested: number;
  futureValue: number;
  returns: number;
  /** future value in today's money (needs inflationPct) */
  realValue: number;
  /** final monthly investment amount */
  lastMonthlyInvestment: number;
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculateSip(input: SipInput): SipResult {
  const n = Math.round(input.years * 12);
  const i = periodRate(input.annualReturn, 12, input.rateMethod);
  const steps: FlowStep[] = [];
  let balance = 0;
  let lastAmount = input.monthlyInvestment;
  for (let k = 0; k < n; k++) {
    const amount = input.monthlyInvestment * Math.pow(1 + input.stepUpPct / 100, Math.floor(k / 12));
    lastAmount = amount;
    const opening = balance;
    let returns: number;
    if (input.timing === 'start') {
      returns = (opening + amount) * i;
      balance = opening + amount + returns;
    } else {
      returns = opening * i;
      balance = opening + returns + amount;
    }
    steps.push({ opening, flow: amount, returns, closing: balance });
  }
  const invested = steps.reduce((s, x) => s + x.flow, 0);
  const realValue = balance / Math.pow(1 + input.inflationPct / 100, n / 12);
  return {
    invested,
    futureValue: balance,
    returns: balance - invested,
    realValue,
    lastMonthlyInvestment: lastAmount,
    yearly: yearRows(steps, 12),
    warnings: collect(unrealisticReturn(input.annualReturn)),
  };
}
