import { z } from 'zod';
import { collect, daysBetween, isoDate, type Warning } from './common';

export const delayInterestInputSchema = z
  .object({
    amountPaid: z.number().min(1).max(1e12),
    annualRatePct: z.number().min(0).max(40),
    dueDate: isoDate,
    actualDate: isoDate,
  })
  .refine((v) => !Number.isNaN(Date.parse(v.dueDate)) && !Number.isNaN(Date.parse(v.actualDate)), {
    message: 'invalidDate',
  });
export type DelayInterestInput = z.infer<typeof delayInterestInputSchema>;

export const delayInterestDefaults: DelayInterestInput = {
  amountPaid: 5_000_000,
  annualRatePct: 9,
  dueDate: '2024-01-01',
  actualDate: '2025-01-01',
};

export interface DelayInterestResult {
  delayDays: number;
  delayMonths: number;
  interest: number;
  /** interest for one month of delay */
  interestPerMonth: number;
  totalDue: number;
  warnings: Warning[];
}

/** Simple interest on the amount paid for each day of delay: amount x rate x days / 365. */
export function calculateDelayInterest(input: DelayInterestInput): DelayInterestResult {
  const rawDays = daysBetween(input.dueDate, input.actualDate);
  const delayDays = Math.max(0, rawDays);
  const interest = (input.amountPaid * input.annualRatePct * delayDays) / 100 / 365;
  return {
    delayDays,
    delayMonths: delayDays / (365 / 12),
    interest,
    interestPerMonth: (input.amountPaid * input.annualRatePct) / 100 / 12,
    totalDue: input.amountPaid + interest,
    warnings: collect(rawDays <= 0 && { code: 'noDelay' }),
  };
}
