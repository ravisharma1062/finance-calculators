import { z } from 'zod';
import { collect, yearRows, type FlowStep, type Warning, type YearRow } from './common';

export const ppfInputSchema = z.object({
  yearlyDeposit: z.number().min(0).max(1e9),
  years: z.number().int().min(1).max(50),
  annualRate: z.number().min(0).max(30),
  depositTiming: z.enum(['start', 'end']),
  /** yearly deposit limit of the scheme (data, set from country config). 0 = no limit check. */
  yearlyLimit: z.number().min(0).max(1e9),
});
export type PpfInput = z.infer<typeof ppfInputSchema>;

export const ppfDefaults: PpfInput = {
  yearlyDeposit: 150_000,
  years: 15,
  annualRate: 7.1,
  depositTiming: 'start',
  yearlyLimit: 150_000,
};

export interface PpfResult {
  invested: number;
  maturity: number;
  interest: number;
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculatePpf(input: PpfInput): PpfResult {
  const r = input.annualRate / 100;
  const steps: FlowStep[] = [];
  let balance = 0;
  for (let y = 0; y < input.years; y++) {
    const opening = balance;
    const interest = input.depositTiming === 'start' ? (opening + input.yearlyDeposit) * r : opening * r;
    balance = opening + input.yearlyDeposit + interest;
    steps.push({ opening, flow: input.yearlyDeposit, returns: interest, closing: balance });
  }
  const invested = input.yearlyDeposit * input.years;
  return {
    invested,
    maturity: balance,
    interest: balance - invested,
    yearly: yearRows(steps, 1),
    warnings: collect(
      input.yearlyLimit > 0 &&
        input.yearlyDeposit > input.yearlyLimit && { code: 'depositAboveLimit', params: { limit: input.yearlyLimit } },
      input.years < 15 && { code: 'ppfMinimumLockIn', params: { years: 15 } },
    ),
  };
}
