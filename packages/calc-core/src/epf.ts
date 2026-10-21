import { z } from 'zod';
import { collect, yearRows, type FlowStep, type Warning, type YearRow } from './common';

export const epfInputSchema = z
  .object({
    monthlyBasicSalary: z.number().min(1).max(1e9),
    employeePct: z.number().min(0).max(100),
    /** share of salary that the employer puts in the EPF (the rest goes to the pension scheme) */
    employerPct: z.number().min(0).max(100),
    salaryHikePct: z.number().min(0).max(50),
    currentBalance: z.number().min(0).max(1e12),
    currentAge: z.number().min(18).max(70),
    retirementAge: z.number().min(19).max(80),
    annualRate: z.number().min(0).max(30),
  })
  .refine((v) => v.retirementAge > v.currentAge, { path: ['retirementAge'], message: 'retirementAfterCurrent' });
export type EpfInput = z.infer<typeof epfInputSchema>;

export const epfDefaults: EpfInput = {
  monthlyBasicSalary: 50_000,
  employeePct: 12,
  employerPct: 3.67,
  salaryHikePct: 6,
  currentBalance: 0,
  currentAge: 28,
  retirementAge: 58,
  annualRate: 8.25,
};

export interface EpfResult {
  employeeTotal: number;
  employerTotal: number;
  invested: number;
  interest: number;
  maturity: number;
  yearly: YearRow[];
  warnings: Warning[];
}

/** Interest is worked out every month on the running balance and added to the account at the end of each year. */
export function calculateEpf(input: EpfInput): EpfResult {
  const years = input.retirementAge - input.currentAge;
  const monthlyRate = input.annualRate / 100 / 12;
  const steps: FlowStep[] = [];
  let balance = input.currentBalance;
  let employeeTotal = 0;
  let employerTotal = 0;
  for (let y = 0; y < years; y++) {
    const salary = input.monthlyBasicSalary * Math.pow(1 + input.salaryHikePct / 100, y);
    const own = (salary * input.employeePct) / 100;
    const employer = (salary * input.employerPct) / 100;
    const opening = balance;
    let accrued = 0;
    let running = balance;
    for (let m = 0; m < 12; m++) {
      running += own + employer;
      accrued += (running - own - employer) * monthlyRate;
    }
    employeeTotal += own * 12;
    employerTotal += employer * 12;
    balance = opening + (own + employer) * 12 + accrued;
    steps.push({ opening, flow: (own + employer) * 12, returns: accrued, closing: balance });
  }
  const invested = employeeTotal + employerTotal;
  return {
    employeeTotal,
    employerTotal,
    invested,
    interest: balance - invested - input.currentBalance,
    maturity: balance,
    yearly: yearRows(steps, 1),
    warnings: collect(),
  };
}
