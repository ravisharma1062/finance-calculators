import { z } from 'zod';
import { RATE_METHODS, periodRate } from './rates';
import { addMonths, collect, isoDate, todayIso, type Warning, type YearRow } from './common';
import { emiAmount, yearlyFromAmort, type AmortRow } from './emi';

export const prepaymentInputSchema = z
  .object({
    loanAmount: z.number().min(1).max(1e12),
    annualRate: z.number().min(0).max(50),
    tenureMonths: z.number().int().min(1).max(600),
    rateMethod: z.enum(RATE_METHODS),
    startDate: isoDate,
    effect: z.enum(['reduceTenure', 'reduceEmi']),
    /** one-time part payment */
    prepaymentAmount: z.number().min(0).max(1e12),
    /** the part payment is made after this many EMIs */
    prepaymentAfterMonth: z.number().int().min(1).max(600),
    /** extra amount paid every month on top of the EMI */
    extraMonthly: z.number().min(0).max(1e10),
  })
  .refine((v) => v.prepaymentAfterMonth <= v.tenureMonths, {
    path: ['prepaymentAfterMonth'],
    message: 'afterMonthWithinTenure',
  });
export type PrepaymentInput = z.infer<typeof prepaymentInputSchema>;

export const prepaymentDefaults: PrepaymentInput = {
  loanAmount: 5_000_000,
  annualRate: 8.5,
  tenureMonths: 240,
  rateMethod: 'nominal',
  startDate: todayIso(),
  effect: 'reduceTenure',
  prepaymentAmount: 500_000,
  prepaymentAfterMonth: 24,
  extraMonthly: 0,
};

export interface PrepaymentResult {
  originalEmi: number;
  originalInterest: number;
  originalMonths: number;
  newEmi: number;
  newInterest: number;
  newMonths: number;
  interestSaved: number;
  monthsSaved: number;
  schedule: AmortRow[];
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculatePrepayment(input: PrepaymentInput): PrepaymentResult {
  const i = periodRate(input.annualRate, 12, input.rateMethod);
  const originalEmi = emiAmount(input.loanAmount, i, input.tenureMonths);
  const originalInterest = originalEmi * input.tenureMonths - input.loanAmount;

  let emi = originalEmi;
  let balance = input.loanAmount;
  const schedule: AmortRow[] = [];
  let month = 0;
  while (balance > 0.005 && month < input.tenureMonths + 1) {
    month += 1;
    const interest = balance * i;
    let principal = Math.min(balance, emi - interest + input.extraMonthly);
    if (principal < 0) principal = 0;
    let payment = principal + interest;
    let closing = balance - principal;
    if (month === input.prepaymentAfterMonth && input.prepaymentAmount > 0 && closing > 0) {
      const extra = Math.min(closing, input.prepaymentAmount);
      principal += extra;
      payment += extra;
      closing -= extra;
      if (input.effect === 'reduceEmi' && closing > 0) {
        emi = emiAmount(closing, i, input.tenureMonths - month);
      }
    }
    if (closing < 0.005) closing = 0;
    schedule.push({
      month,
      date: addMonths(input.startDate, month),
      opening: balance,
      interest,
      principal,
      payment,
      closing,
    });
    balance = closing;
  }
  const newInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const newMonths = schedule.length;
  return {
    originalEmi,
    originalInterest,
    originalMonths: input.tenureMonths,
    newEmi: input.effect === 'reduceEmi' ? emi : originalEmi,
    newInterest,
    newMonths,
    interestSaved: originalInterest - newInterest,
    monthsSaved: input.tenureMonths - newMonths,
    schedule,
    yearly: yearlyFromAmort(schedule),
    warnings: collect(input.prepaymentAmount >= input.loanAmount && { code: 'prepaymentClearsLoan' }),
  };
}
