import { z } from 'zod';
import { collect, unrealisticReturn, yearRows, type FlowStep, type Warning, type YearRow } from './common';

export const lumpsumInputSchema = z.object({
  mode: z.enum(['forward', 'reverse']),
  /** forward: amount invested today. reverse: target amount wanted at the end. */
  amount: z.number().min(1).max(1e12),
  years: z.number().min(1).max(60),
  annualReturn: z.number().min(0).max(50),
  inflationPct: z.number().min(0).max(30),
});
export type LumpsumInput = z.infer<typeof lumpsumInputSchema>;

export const lumpsumDefaults: LumpsumInput = {
  mode: 'forward',
  amount: 500_000,
  years: 10,
  annualReturn: 12,
  inflationPct: 0,
};

export interface LumpsumResult {
  mode: LumpsumInput['mode'];
  invested: number;
  futureValue: number;
  returns: number;
  realValue: number;
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculateLumpsum(input: LumpsumInput): LumpsumResult {
  const r = input.annualReturn / 100;
  const factor = Math.pow(1 + r, input.years);
  const invested = input.mode === 'forward' ? input.amount : input.amount / factor;
  const futureValue = input.mode === 'forward' ? input.amount * factor : input.amount;
  const steps: FlowStep[] = [];
  let balance = invested;
  const wholeYears = Math.ceil(input.years);
  for (let y = 1; y <= wholeYears; y++) {
    const span = Math.min(1, input.years - (y - 1));
    const closing = balance * Math.pow(1 + r, span);
    steps.push({ opening: balance, flow: y === 1 ? invested : 0, returns: closing - balance, closing });
    balance = closing;
  }
  return {
    mode: input.mode,
    invested,
    futureValue,
    returns: futureValue - invested,
    realValue: futureValue / Math.pow(1 + input.inflationPct / 100, input.years),
    yearly: yearRows(steps, 1),
    warnings: collect(unrealisticReturn(input.annualReturn)),
  };
}
