import { z } from 'zod';
import { FREQUENCIES, PERIODS_PER_YEAR } from './rates';
import { collect, unrealisticReturn, type Warning, type YearRow } from './common';

export const fdInputSchema = z.object({
  kind: z.enum(['fd', 'rd']),
  /** fd: lump sum deposited. rd: amount deposited every month. */
  amount: z.number().min(1).max(1e12),
  annualRate: z.number().min(0).max(50),
  years: z.number().min(0.25).max(40),
  compounding: z.enum(FREQUENCIES),
  taxPct: z.number().min(0).max(60),
});
export type FdInput = z.infer<typeof fdInputSchema>;

export const fdDefaults: FdInput = {
  kind: 'fd',
  amount: 500_000,
  annualRate: 7,
  years: 5,
  compounding: 'quarterly',
  taxPct: 0,
};
export const rdDefaults: FdInput = {
  kind: 'rd',
  amount: 10_000,
  annualRate: 6.5,
  years: 5,
  compounding: 'quarterly',
  taxPct: 0,
};

export interface FdResult {
  invested: number;
  maturity: number;
  interest: number;
  tax: number;
  maturityAfterTax: number;
  /** yearly effective yield, percent */
  effectiveYieldPct: number;
  yearly: YearRow[];
  warnings: Warning[];
}

/** Value at `t` years. Bank rates are quoted as nominal rates, compounded `n` times a year. */
function fdValue(input: FdInput, t: number): { invested: number; value: number } {
  const n = PERIODS_PER_YEAR[input.compounding];
  const r = input.annualRate / 100;
  const grow = (years: number) => Math.pow(1 + r / n, n * years);
  if (input.kind === 'fd') return { invested: input.amount, value: input.amount * grow(t) };
  const months = Math.floor(t * 12 + 1e-9);
  let value = 0;
  for (let k = 0; k < months; k++) value += input.amount * grow((months - k) / 12);
  return { invested: input.amount * months, value };
}

export function calculateFd(input: FdInput): FdResult {
  const total = fdValue(input, input.years);
  const interest = total.value - total.invested;
  const tax = (interest * input.taxPct) / 100;
  const yearly: YearRow[] = [];
  let prev = 0;
  let prevInvested = 0;
  let cumReturns = 0;
  for (let y = 1; y <= Math.ceil(input.years); y++) {
    const t = Math.min(y, input.years);
    const v = fdValue(input, t);
    const flow = v.invested - prevInvested;
    const returns = v.value - prev - flow;
    cumReturns += returns;
    yearly.push({
      year: y,
      label: String(y),
      opening: prev,
      flow,
      returns,
      closing: v.value,
      cumulativeFlow: v.invested,
      cumulativeReturns: cumReturns,
    });
    prev = v.value;
    prevInvested = v.invested;
  }
  const n = PERIODS_PER_YEAR[input.compounding];
  return {
    invested: total.invested,
    maturity: total.value,
    interest,
    tax,
    maturityAfterTax: total.value - tax,
    effectiveYieldPct: (Math.pow(1 + input.annualRate / 100 / n, n) - 1) * 100,
    yearly,
    warnings: collect(unrealisticReturn(input.annualRate)),
  };
}
