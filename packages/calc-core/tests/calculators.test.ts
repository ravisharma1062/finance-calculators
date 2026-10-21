import { describe, expect, it } from 'vitest';
import {
  FREQUENCIES,
  addMonths,
  annuityFactor,
  calculateDelayInterest,
  calculateEmi,
  calculateEpf,
  calculateFd,
  calculateFire,
  calculateGoal,
  calculateInflation,
  calculateLumpsum,
  calculateNps,
  calculatePpf,
  calculatePrepayment,
  calculateRentVsBuy,
  calculateRetirementAccount,
  calculateSip,
  calculateStepupSip,
  daysBetween,
  delayInterestDefaults,
  delayInterestInputSchema,
  effectiveAnnualPct,
  emiAmount,
  emiDefaults,
  epfDefaults,
  fdDefaults,
  fireDefaults,
  fireInputSchema,
  fvAnnuityFactor,
  goalDefaults,
  inflationDefaults,
  lumpsumDefaults,
  npsDefaults,
  npsInputSchema,
  periodRate,
  periodRateFor,
  ppfDefaults,
  prepaymentDefaults,
  prepaymentInputSchema,
  rdDefaults,
  rentVsBuyDefaults,
  retirementAccountDefaults,
  sipDefaults,
  stepupSipDefaults,
  todayIso,
} from '../src';

describe('rates', () => {
  it('effective vs nominal', () => {
    expect(periodRate(12, 12, 'nominal')).toBeCloseTo(0.01, 12);
    expect(Math.pow(1 + periodRate(12, 12, 'effective'), 12)).toBeCloseTo(1.12, 12);
    expect(periodRate(8, 4, 'effective')).toBeCloseTo(Math.pow(1.08, 0.25) - 1, 12);
    expect(periodRateFor(8, 'halfYearly', 'nominal')).toBeCloseTo(0.04, 12);
    expect(periodRateFor(8, 'annual')).toBeCloseTo(0.08, 12);
    expect(effectiveAnnualPct(0.01, 12)).toBeCloseTo(12.6825, 3);
    expect(FREQUENCIES).toHaveLength(4);
  });
  it('annuity helpers handle zero rate', () => {
    expect(annuityFactor(0, 10)).toBe(10);
    expect(fvAnnuityFactor(0, 10)).toBe(10);
    expect(annuityFactor(0.01, 12)).toBeCloseTo(11.2551, 3);
    expect(fvAnnuityFactor(0.01, 12)).toBeCloseTo(12.6825, 3);
  });
  it('date helpers', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('SIP', () => {
  it('matches the closed form', () => {
    const r = calculateSip({
      ...sipDefaults,
      rateMethod: 'nominal',
      annualReturn: 12,
      monthlyInvestment: 10_000,
      years: 15,
    });
    const i = 0.01;
    const n = 180;
    const expected = 10_000 * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    expect(r.futureValue).toBeCloseTo(expected, 4);
    expect(r.invested).toBe(1_800_000);
    expect(r.returns).toBeCloseTo(expected - 1_800_000, 4);
    expect(r.yearly).toHaveLength(15);
    expect(r.yearly.at(-1)!.closing).toBeCloseTo(expected, 4);
  });
  it('end timing is lower than start timing', () => {
    const start = calculateSip({ ...sipDefaults, timing: 'start' });
    const end = calculateSip({ ...sipDefaults, timing: 'end' });
    expect(end.futureValue).toBeLessThan(start.futureValue);
  });
  it('zero rate and inflation', () => {
    const r = calculateSip({ ...sipDefaults, annualReturn: 0, inflationPct: 6 });
    expect(r.futureValue).toBeCloseTo(r.invested, 6);
    expect(r.realValue).toBeLessThan(r.futureValue);
  });
  it('step-up raises the final amount', () => {
    const r = calculateSip({ ...sipDefaults, stepUpPct: 10, annualReturn: 0, years: 3, monthlyInvestment: 1000 });
    expect(r.invested).toBeCloseTo(12_000 + 13_200 + 14_520, 6);
    expect(r.lastMonthlyInvestment).toBeCloseTo(1210, 6);
  });
  it('flags unrealistic returns', () => {
    expect(calculateSip({ ...sipDefaults, annualReturn: 30 }).warnings[0]?.code).toBe('unrealisticReturn');
  });
});

describe('step-up SIP', () => {
  it('beats a flat SIP', () => {
    const r = calculateStepupSip(stepupSipDefaults);
    expect(r.extraFromStepUp).toBeGreaterThan(0);
    expect(r.futureValue - r.flatFutureValue).toBeCloseTo(r.extraFromStepUp, 6);
    expect(r.invested).toBeGreaterThan(r.flatInvested);
  });
});

describe('lump sum', () => {
  it('forward', () => {
    const r = calculateLumpsum({ ...lumpsumDefaults, amount: 500_000, years: 10, annualReturn: 12 });
    expect(r.futureValue).toBeCloseTo(1_552_924.1, 0);
    expect(r.yearly).toHaveLength(10);
    expect(r.yearly.at(-1)!.closing).toBeCloseTo(r.futureValue, 4);
  });
  it('reverse', () => {
    const r = calculateLumpsum({ ...lumpsumDefaults, mode: 'reverse', amount: 1_552_924.1, years: 10 });
    expect(r.invested).toBeCloseTo(500_000, 0);
  });
  it('handles fractional years and inflation', () => {
    const r = calculateLumpsum({ ...lumpsumDefaults, years: 2.5, inflationPct: 5 });
    expect(r.yearly).toHaveLength(3);
    expect(r.yearly.at(-1)!.closing).toBeCloseTo(r.futureValue, 4);
    expect(r.realValue).toBeLessThan(r.futureValue);
  });
});

describe('goal planner', () => {
  it('inflates the goal and finds the SIP and lump sum', () => {
    const r = calculateGoal({
      ...goalDefaults,
      goalAmountToday: 1_000_000,
      years: 10,
      goalInflationPct: 6,
      annualReturn: 12,
      existingSavings: 0,
    });
    expect(r.goalAmountFuture).toBeCloseTo(1_790_847.7, 0);
    const check = calculateSip({
      ...sipDefaults,
      monthlyInvestment: r.requiredMonthlySip,
      years: 10,
      annualReturn: 12,
      timing: 'start',
    });
    expect(check.futureValue).toBeCloseTo(r.goalAmountFuture, 2);
    const lump = calculateLumpsum({ ...lumpsumDefaults, amount: r.requiredLumpsum, years: 10, annualReturn: 12 });
    expect(lump.futureValue).toBeCloseTo(r.goalAmountFuture, 2);
  });
  it('existing savings can cover the goal', () => {
    const r = calculateGoal({ ...goalDefaults, existingSavings: 10_000_000 });
    expect(r.shortfall).toBe(0);
    expect(r.warnings.some((w) => w.code === 'goalAlreadyMet')).toBe(true);
  });
});

describe('inflation', () => {
  it('future cost and purchasing power', () => {
    const r = calculateInflation(inflationDefaults);
    expect(r.futureCost).toBeCloseTo(320_713.55, 1);
    expect(r.purchasingPower).toBeCloseTo(31_180.47, 1);
    expect(r.powerLostPct).toBeCloseTo(68.82, 1);
    expect(r.yearly).toHaveLength(20);
  });
});

describe('FIRE', () => {
  it('corpus is expenses at retirement divided by the withdrawal rate', () => {
    const r = calculateFire({ ...fireDefaults, inflationPct: 0, safeWithdrawalPct: 4, annualExpenses: 600_000 });
    expect(r.fireCorpus).toBeCloseTo(15_000_000, 4);
    expect(r.yearsToRetire).toBe(15);
  });
  it('finds the FIRE age and extra SIP needed', () => {
    const r = calculateFire(fireDefaults);
    expect(r.fireAge).not.toBeNull();
    expect(r.yearly).toHaveLength(15);
    const poor = calculateFire({ ...fireDefaults, monthlyInvestment: 0, currentSavings: 0 });
    expect(poor.onTrack).toBe(false);
    expect(poor.fireAge).toBeNull();
    expect(poor.warnings.some((w) => w.code === 'fireNotReached')).toBe(true);
    const topUp = calculateSip({
      ...sipDefaults,
      monthlyInvestment: poor.extraMonthlyNeeded,
      years: 15,
      annualReturn: fireDefaults.annualReturn,
    });
    expect(topUp.futureValue).toBeCloseTo(poor.fireCorpus, 2);
  });
  it('warns for a high withdrawal rate and rejects retirement before today', () => {
    expect(
      calculateFire({ ...fireDefaults, safeWithdrawalPct: 7 }).warnings.some((w) => w.code === 'highWithdrawalRate'),
    ).toBe(true);
    expect(fireInputSchema.safeParse({ ...fireDefaults, retirementAge: 20 }).success).toBe(false);
  });
});

describe('EMI', () => {
  it('computes the monthly payment', () => {
    expect(emiAmount(5_000_000, 0.085 / 12, 240)).toBeCloseTo(43_391.16, 1);
    expect(emiAmount(1200, 0, 12)).toBe(100);
    expect(emiAmount(1000, 0.01, 0)).toBe(1000);
  });
  it('builds a schedule that pays the loan off', () => {
    const r = calculateEmi({ ...emiDefaults, startDate: '2026-01-15' });
    expect(r.schedule).toHaveLength(240);
    expect(r.schedule.at(-1)!.closing).toBeCloseTo(0, 6);
    expect(r.schedule[0]!.date).toBe('2026-02-15');
    expect(r.totalPayment).toBeCloseTo(r.emi * 240, 2);
    expect(r.totalInterest).toBeCloseTo(r.totalPayment - 5_000_000, 6);
    expect(r.yearly).toHaveLength(20);
    expect(r.yearly[0]!.opening).toBe(5_000_000);
    expect(r.interestSharePct).toBeGreaterThan(50);
  });
  it('zero interest and high-rate warning', () => {
    const z = calculateEmi({ ...emiDefaults, annualRate: 0, tenureMonths: 10, loanAmount: 1000 });
    expect(z.emi).toBe(100);
    expect(z.totalInterest).toBeCloseTo(0, 8);
    expect(calculateEmi({ ...emiDefaults, annualRate: 30 }).warnings).toHaveLength(1);
  });
  it('effective rate method gives lower interest', () => {
    const eff = calculateEmi({ ...emiDefaults, rateMethod: 'effective' });
    const nom = calculateEmi({ ...emiDefaults, rateMethod: 'nominal' });
    expect(eff.totalInterest).toBeLessThan(nom.totalInterest);
  });
});

describe('prepayment', () => {
  it('reduce tenure saves months and interest', () => {
    const r = calculatePrepayment(prepaymentDefaults);
    expect(r.newMonths).toBeLessThan(240);
    expect(r.monthsSaved).toBe(240 - r.newMonths);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.newEmi).toBeCloseTo(r.originalEmi, 6);
    expect(r.schedule.at(-1)!.closing).toBe(0);
    expect(r.yearly.length).toBeGreaterThan(0);
  });
  it('reduce EMI keeps the tenure but lowers the payment', () => {
    const r = calculatePrepayment({ ...prepaymentDefaults, effect: 'reduceEmi' });
    expect(r.newEmi).toBeLessThan(r.originalEmi);
    expect(r.newMonths).toBe(240);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
  it('extra monthly payment also helps', () => {
    const none = calculatePrepayment({ ...prepaymentDefaults, prepaymentAmount: 0 });
    expect(none.interestSaved).toBeCloseTo(0, 4);
    const extra = calculatePrepayment({ ...prepaymentDefaults, prepaymentAmount: 0, extraMonthly: 5000 });
    expect(extra.monthsSaved).toBeGreaterThan(0);
  });
  it('clearing the loan and validation', () => {
    const r = calculatePrepayment({ ...prepaymentDefaults, prepaymentAmount: 99_999_999 });
    expect(r.warnings[0]?.code).toBe('prepaymentClearsLoan');
    expect(r.newMonths).toBe(24);
    expect(prepaymentInputSchema.safeParse({ ...prepaymentDefaults, prepaymentAfterMonth: 300 }).success).toBe(false);
  });
});

describe('FD and RD', () => {
  it('FD with quarterly compounding', () => {
    const r = calculateFd({ ...fdDefaults, amount: 100_000, annualRate: 8, years: 1, compounding: 'quarterly' });
    expect(r.maturity).toBeCloseTo(108_243.22, 1);
    expect(r.effectiveYieldPct).toBeCloseTo(8.2432, 3);
    expect(r.interest).toBeCloseTo(8243.22, 1);
  });
  it('FD tax and yearly rows', () => {
    const r = calculateFd({ ...fdDefaults, taxPct: 30 });
    expect(r.tax).toBeCloseTo(r.interest * 0.3, 6);
    expect(r.maturityAfterTax).toBeCloseTo(r.maturity - r.tax, 6);
    expect(r.yearly).toHaveLength(5);
    expect(r.yearly.at(-1)!.closing).toBeCloseTo(r.maturity, 6);
    expect(r.yearly.at(-1)!.cumulativeReturns).toBeCloseTo(r.interest, 4);
  });
  it('RD', () => {
    const r = calculateFd({ ...rdDefaults, amount: 1000, annualRate: 0, years: 2 });
    expect(r.maturity).toBeCloseTo(24_000, 6);
    expect(r.invested).toBe(24_000);
    const paid = calculateFd({ ...rdDefaults, amount: 10_000, annualRate: 6.5, years: 5 });
    expect(paid.invested).toBe(600_000);
    expect(paid.maturity).toBeGreaterThan(paid.invested);
    expect(paid.yearly).toHaveLength(5);
  });
  it('fractional years', () => {
    const r = calculateFd({ ...fdDefaults, years: 1.5 });
    expect(r.yearly).toHaveLength(2);
    expect(r.yearly.at(-1)!.closing).toBeCloseTo(r.maturity, 6);
  });
});

describe('PPF', () => {
  it('annual compounding', () => {
    const r = calculatePpf({ ...ppfDefaults, yearlyDeposit: 100_000, years: 2, annualRate: 10 });
    expect(r.maturity).toBeCloseTo((100_000 * 1.1 + 100_000) * 1.1, 6);
    expect(r.invested).toBe(200_000);
    const end = calculatePpf({
      ...ppfDefaults,
      yearlyDeposit: 100_000,
      years: 2,
      annualRate: 10,
      depositTiming: 'end',
    });
    expect(end.maturity).toBeLessThan(r.maturity);
  });
  it('15 year default and warnings', () => {
    const r = calculatePpf(ppfDefaults);
    expect(r.yearly).toHaveLength(15);
    expect(r.maturity).toBeGreaterThan(4_000_000);
    expect(r.warnings).toHaveLength(0);
    const w = calculatePpf({ ...ppfDefaults, yearlyDeposit: 200_000, years: 10 });
    expect(w.warnings.map((x) => x.code).sort()).toEqual(['depositAboveLimit', 'ppfMinimumLockIn']);
  });
});

describe('NPS', () => {
  it('builds a corpus, lump sum and pension', () => {
    const r = calculateNps(npsDefaults);
    expect(r.invested).toBe(3_600_000);
    expect(r.corpus).toBeGreaterThan(r.invested);
    expect(r.lumpSum + r.annuityCorpus).toBeCloseTo(r.corpus, 6);
    expect(r.monthlyPension).toBeCloseTo((r.annuityCorpus * 0.06) / 12, 6);
    expect(r.yearly).toHaveLength(30);
  });
  it('warns below the minimum annuity and validates ages', () => {
    expect(calculateNps({ ...npsDefaults, annuityPct: 20 }).warnings.map((w) => w.code)).toContain(
      'annuityBelowMinimum',
    );
    expect(npsInputSchema.safeParse({ ...npsDefaults, retirementAge: 25 }).success).toBe(false);
    expect(calculateNps({ ...npsDefaults, annualReturn: 25, stepUpPct: 5 }).warnings.map((w) => w.code)).toContain(
      'unrealisticReturn',
    );
  });
});

describe('EPF', () => {
  it('adds up contributions and interest', () => {
    const r = calculateEpf({ ...epfDefaults, salaryHikePct: 0, annualRate: 0, currentAge: 30, retirementAge: 31 });
    expect(r.employeeTotal).toBeCloseTo(50_000 * 0.12 * 12, 6);
    expect(r.employerTotal).toBeCloseTo(50_000 * 0.0367 * 12, 6);
    expect(r.maturity).toBeCloseTo(r.invested, 6);
    expect(r.interest).toBeCloseTo(0, 6);
  });
  it('interest on running balance', () => {
    const r = calculateEpf(epfDefaults);
    expect(r.yearly).toHaveLength(30);
    expect(r.maturity).toBeCloseTo(r.invested + r.interest, 4);
    expect(r.interest).toBeGreaterThan(0);
    const r2 = calculateEpf({ ...epfDefaults, currentBalance: 100_000 });
    expect(r2.maturity).toBeGreaterThan(r.maturity);
    expect(r2.maturity).toBeCloseTo(r2.invested + r2.interest + 100_000, 4);
  });
});

describe('rent vs buy', () => {
  it('compares net worth', () => {
    const r = calculateRentVsBuy(rentVsBuyDefaults);
    expect(r.downPayment).toBeCloseTo(1_600_000, 6);
    expect(r.yearly).toHaveLength(15);
    expect(r.homeValueAtEnd).toBeCloseTo(8_000_000 * 1.05 ** 15, 0);
    expect(r.difference).toBeCloseTo(r.buyNetWorth - r.rentNetWorth, 6);
    expect(['buy', 'rent']).toContain(r.verdict);
    expect(r.loanBalanceAtEnd).toBeGreaterThan(0);
  });
  it('very high rent favours buying, very low rent favours renting', () => {
    const high = calculateRentVsBuy({ ...rentVsBuyDefaults, monthlyRent: 150_000 });
    const low = calculateRentVsBuy({ ...rentVsBuyDefaults, monthlyRent: 5_000, investReturnPct: 14 });
    expect(high.verdict).toBe('buy');
    expect(low.verdict).toBe('rent');
    expect(high.warnings.map((w) => w.code)).toContain('rentVeryHigh');
  });
  it('loan finishes before the horizon', () => {
    const r = calculateRentVsBuy({ ...rentVsBuyDefaults, loanYears: 10, horizonYears: 12 });
    expect(r.loanBalanceAtEnd).toBeCloseTo(0, 4);
    expect(calculateRentVsBuy({ ...rentVsBuyDefaults, horizonYears: 3 }).warnings.map((w) => w.code)).toContain(
      'shortHorizon',
    );
  });
});

describe('builder delay interest', () => {
  it('simple interest per day', () => {
    const r = calculateDelayInterest(delayInterestDefaults);
    expect(r.delayDays).toBe(366);
    expect(r.interest).toBeCloseTo((5_000_000 * 0.09 * 366) / 365, 4);
    expect(r.interestPerMonth).toBeCloseTo(37_500, 6);
    expect(r.totalDue).toBeCloseTo(5_000_000 + r.interest, 6);
    expect(r.delayMonths).toBeCloseTo(12.03, 1);
  });
  it('no delay', () => {
    const r = calculateDelayInterest({ ...delayInterestDefaults, actualDate: '2023-06-01' });
    expect(r.delayDays).toBe(0);
    expect(r.interest).toBe(0);
    expect(r.warnings[0]?.code).toBe('noDelay');
  });
  it('rejects bad dates', () => {
    expect(delayInterestInputSchema.safeParse({ ...delayInterestDefaults, dueDate: '2024-99-99' }).success).toBe(false);
    expect(delayInterestInputSchema.safeParse({ ...delayInterestDefaults, dueDate: '2024-01-01' }).success).toBe(true);
  });
});

describe('retirement account', () => {
  it('adds employer match and government top-up', () => {
    const r = calculateRetirementAccount({
      ...retirementAccountDefaults,
      yearlyContribution: 10_000,
      employerMatchPct: 50,
      governmentTopUpPct: 25,
      annualReturn: 0,
      years: 2,
    });
    expect(r.ownTotal).toBe(20_000);
    expect(r.employerTotal).toBe(10_000);
    expect(r.governmentTotal).toBe(5_000);
    expect(r.futureValue).toBe(35_000);
    expect(r.returns).toBeCloseTo(0, 8);
  });
  it('grows and warns above the limit', () => {
    const r = calculateRetirementAccount({
      ...retirementAccountDefaults,
      yearlyLimit: 5_000,
      currentBalance: 1000,
      stepUpPct: 3,
    });
    expect(r.futureValue).toBeGreaterThan(r.invested);
    expect(r.realValue).toBeLessThan(r.futureValue);
    expect(r.warnings.map((w) => w.code)).toContain('depositAboveLimit');
    expect(r.yearly).toHaveLength(25);
  });
});
