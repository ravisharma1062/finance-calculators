import { z } from 'zod';
import { RATE_METHODS, periodRate } from './rates';
import { addMonths, collect, isoDate, todayIso, type Warning, type YearRow } from './common';

export const emiInputSchema = z.object({
  loanAmount: z.number().min(1).max(1e12),
  annualRate: z.number().min(0).max(50),
  tenureMonths: z.number().int().min(1).max(600),
  rateMethod: z.enum(RATE_METHODS),
  startDate: isoDate,
});
export type EmiInput = z.infer<typeof emiInputSchema>;

export const emiDefaults: EmiInput = {
  loanAmount: 5_000_000,
  annualRate: 8.5,
  tenureMonths: 240,
  rateMethod: 'nominal',
  startDate: todayIso(),
};

/** Monthly payment: P x i x (1 + i)^n / ((1 + i)^n - 1). */
export function emiAmount(principal: number, i: number, n: number): number {
  if (n <= 0) return principal;
  if (Math.abs(i) < 1e-12) return principal / n;
  const f = Math.pow(1 + i, n);
  return (principal * i * f) / (f - 1);
}

export interface AmortRow {
  month: number;
  date: string;
  opening: number;
  interest: number;
  principal: number;
  payment: number;
  closing: number;
}

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  interestSharePct: number;
  schedule: AmortRow[];
  yearly: YearRow[];
  warnings: Warning[];
}

export function yearlyFromAmort(schedule: AmortRow[]): YearRow[] {
  const rows: YearRow[] = [];
  let cumPay = 0;
  let cumInt = 0;
  schedule.forEach((r, idx) => {
    const year = Math.floor(idx / 12) + 1;
    let row = rows[rows.length - 1];
    if (!row || row.year !== year) {
      row = {
        year,
        label: String(year),
        opening: r.opening,
        flow: 0,
        returns: 0,
        closing: r.closing,
        cumulativeFlow: 0,
        cumulativeReturns: 0,
      };
      rows.push(row);
    }
    row.flow += r.payment;
    row.returns += r.interest;
    row.closing = r.closing;
    cumPay += r.payment;
    cumInt += r.interest;
    row.cumulativeFlow = cumPay;
    row.cumulativeReturns = cumInt;
  });
  return rows;
}

export function calculateEmi(input: EmiInput): EmiResult {
  const i = periodRate(input.annualRate, 12, input.rateMethod);
  const emi = emiAmount(input.loanAmount, i, input.tenureMonths);
  const schedule: AmortRow[] = [];
  let balance = input.loanAmount;
  for (let m = 1; m <= input.tenureMonths; m++) {
    const interest = balance * i;
    const principal = m === input.tenureMonths ? balance : Math.min(balance, emi - interest);
    const payment = principal + interest;
    const closing = Math.max(0, balance - principal);
    schedule.push({
      month: m,
      date: addMonths(input.startDate, m),
      opening: balance,
      interest,
      principal,
      payment,
      closing,
    });
    balance = closing;
  }
  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = totalPayment - input.loanAmount;
  return {
    emi,
    totalInterest,
    totalPayment,
    interestSharePct: (totalInterest / totalPayment) * 100,
    schedule,
    yearly: yearlyFromAmort(schedule),
    warnings: collect(input.annualRate > 25 && { code: 'highInterestRate', params: { rate: input.annualRate } }),
  };
}
