import { z } from 'zod';
import { collect, unrealisticReturn, yearRows, type FlowStep, type Warning, type YearRow } from './common';

/**
 * One formula for tax-advantaged accounts such as 401(k), IRA, ISA and SIPP.
 * The rules (limits, employer match, government top-up) are data, set from country config.
 */
export const retirementAccountInputSchema = z.object({
  yearlyContribution: z.number().min(0).max(1e10),
  /** employer adds this share of your own contribution (401k match) */
  employerMatchPct: z.number().min(0).max(300),
  /** government adds this share on top of your contribution (SIPP basic-rate relief is 25%) */
  governmentTopUpPct: z.number().min(0).max(100),
  stepUpPct: z.number().min(0).max(50),
  years: z.number().int().min(1).max(60),
  annualReturn: z.number().min(0).max(40),
  inflationPct: z.number().min(0).max(30),
  currentBalance: z.number().min(0).max(1e12),
  /** yearly allowance of the account. 0 = no limit check. */
  yearlyLimit: z.number().min(0).max(1e10),
});
export type RetirementAccountInput = z.infer<typeof retirementAccountInputSchema>;

export const retirementAccountDefaults: RetirementAccountInput = {
  yearlyContribution: 10_000,
  employerMatchPct: 0,
  governmentTopUpPct: 0,
  stepUpPct: 0,
  years: 25,
  annualReturn: 7,
  inflationPct: 2.5,
  currentBalance: 0,
  yearlyLimit: 0,
};

export interface RetirementAccountResult {
  ownTotal: number;
  employerTotal: number;
  governmentTotal: number;
  invested: number;
  futureValue: number;
  returns: number;
  realValue: number;
  yearly: YearRow[];
  warnings: Warning[];
}

export function calculateRetirementAccount(input: RetirementAccountInput): RetirementAccountResult {
  const r = input.annualReturn / 100;
  const steps: FlowStep[] = [];
  let balance = input.currentBalance;
  let ownTotal = 0;
  let employerTotal = 0;
  let governmentTotal = 0;
  for (let y = 0; y < input.years; y++) {
    const own = input.yearlyContribution * Math.pow(1 + input.stepUpPct / 100, y);
    const employer = (own * input.employerMatchPct) / 100;
    const government = (own * input.governmentTopUpPct) / 100;
    const flow = own + employer + government;
    const opening = balance;
    const returns = (opening + flow) * r;
    balance = opening + flow + returns;
    ownTotal += own;
    employerTotal += employer;
    governmentTotal += government;
    steps.push({ opening, flow, returns, closing: balance });
  }
  const invested = ownTotal + employerTotal + governmentTotal + input.currentBalance;
  return {
    ownTotal,
    employerTotal,
    governmentTotal,
    invested,
    futureValue: balance,
    returns: balance - invested,
    realValue: balance / Math.pow(1 + input.inflationPct / 100, input.years),
    yearly: yearRows(steps, 1),
    warnings: collect(
      unrealisticReturn(input.annualReturn),
      input.yearlyLimit > 0 &&
        input.yearlyContribution > input.yearlyLimit && {
          code: 'depositAboveLimit',
          params: { limit: input.yearlyLimit },
        },
    ),
  };
}
