import { describe, expect, it } from 'vitest';
import {
  calculateSwp,
  pvOfUnitWithdrawals,
  pvOfUnitWithdrawalsClosedForm,
  splitMonths,
  swpDefaults,
  swpInputSchema,
  type SwpInput,
} from '../src/swp';

const base: SwpInput = { ...swpDefaults, startDate: '2026-01-01', annualReturn: 6 };

describe('SWP fixtures (nominal, 6%)', () => {
  const nominal: SwpInput = { ...base, rateMethod: 'nominal' };

  it('finds the corpus for 25,000 x 180 months', () => {
    const r = calculateSwp({ ...nominal, mode: 'corpus', withdrawal: 25_000, years: 15 });
    // exact: 25,000 x (1 - 1.005^-180) / 0.005. PLAN.md rounds this to about 29,61,000.
    expect(Math.abs(r.corpus - 2_962_587)).toBeLessThan(5);
    expect(Math.abs(r.corpus - 2_961_000)).toBeLessThan(2_000);
  });

  it('finds the corpus for 50,000 x 60 months', () => {
    const r = calculateSwp({ ...nominal, mode: 'corpus', withdrawal: 50_000, years: 5 });
    expect(Math.abs(r.corpus - 2_586_000)).toBeLessThan(1_000);
  });

  it('finds how long 20 lakh lasts at 25,000 a month (about 102.4 months)', () => {
    const r = calculateSwp({ ...nominal, mode: 'duration', corpus: 2_000_000, withdrawal: 25_000 });
    const closed = -Math.log(1 - (2_000_000 * 0.005) / 25_000) / Math.log(1.005);
    expect(closed).toBeCloseTo(102.4, 1);
    expect(r.moneyLastsMonths).toBeGreaterThan(101.5);
    expect(r.moneyLastsMonths).toBeLessThan(103.5);
  });

  it('keep principal: 1 crore at 6% gives 50,000 a month', () => {
    const r = calculateSwp({ ...nominal, mode: 'keep', corpus: 10_000_000 });
    expect(r.withdrawal).toBeCloseTo(50_000, 6);
    expect(r.finalBalance).toBeCloseTo(10_000_000, 3);
  });
});

describe('SWP fixtures (effective, 6%, 20 lakh, 25,000 a month)', () => {
  const r = calculateSwp({ ...base, mode: 'useUp', corpus: 2_000_000, withdrawal: 25_000, years: 15 });

  it('balance after year 1', () => {
    const row = r.schedule[11]!;
    expect(Math.abs(row.closingBalance - 1_811_837)).toBeLessThanOrEqual(5);
  });

  it('lasts 101 full withdrawals', () => {
    expect(r.fullWithdrawals).toBe(101);
    expect(r.totalWithdrawn).toBe(2_525_000);
    // PLAN.md says about 18,262, but that cannot hold together with its own year-1 balance
    // (1,811,837). The exact value for the same rate is 14,821. See DECISIONS.md.
    expect(Math.abs(r.finalBalance - 14_821)).toBeLessThanOrEqual(1);
    expect(r.finalPayout).toBeGreaterThan(0);
  });

  it('warns when money ends early', () => {
    expect(r.lastsFullPeriod).toBe(false);
    const w = r.warnings.find((x) => x.code === 'endsEarly')!;
    expect(w.params).toMatchObject({ years: 8, months: 5, plannedYears: 15, plannedMonths: 0 });
    expect(r.moneyLastsMonths).toBeGreaterThan(101);
    expect(r.moneyLastsMonths).toBeLessThan(102);
  });
});

describe('SWP behaviour', () => {
  it('lasts the full period when the corpus is big enough', () => {
    const r = calculateSwp({ ...base, corpus: 10_000_000, withdrawal: 25_000, years: 10 });
    expect(r.lastsFullPeriod).toBe(true);
    expect(r.fullWithdrawals).toBe(120);
    expect(r.warnings.find((w) => w.code === 'endsEarly')).toBeUndefined();
    expect(r.warnings.find((w) => w.code === 'growthCoversWithdrawal')).toBeDefined();
  });

  it('solves corpus, withdrawal and back (round trip)', () => {
    const c = calculateSwp({ ...base, mode: 'corpus', withdrawal: 30_000, years: 12 });
    const w = calculateSwp({ ...base, mode: 'withdrawal', corpus: c.corpus, years: 12 });
    expect(w.withdrawal).toBeCloseTo(30_000, 4);
    const sim = calculateSwp({ ...base, mode: 'useUp', corpus: c.corpus, withdrawal: 30_000, years: 12 });
    expect(sim.lastsFullPeriod).toBe(true);
    expect(sim.finalBalance).toBeLessThan(1);
  });

  it('start-of-period timing needs a larger corpus than end-of-period', () => {
    const end = calculateSwp({ ...base, mode: 'corpus', timing: 'end' });
    const start = calculateSwp({ ...base, mode: 'corpus', timing: 'start' });
    expect(start.corpus / end.corpus).toBeCloseTo(1 + end.periodRate, 8);
    const sim = calculateSwp({ ...base, mode: 'useUp', corpus: start.corpus, timing: 'start' });
    expect(sim.finalBalance).toBeLessThan(1);
    const w = calculateSwp({ ...base, mode: 'withdrawal', corpus: start.corpus, timing: 'start' });
    expect(w.withdrawal).toBeCloseTo(base.withdrawal, 4);
  });

  it('duration says "never used up" when growth beats the withdrawal', () => {
    const r = calculateSwp({ ...base, mode: 'duration', corpus: 10_000_000, withdrawal: 25_000 });
    expect(r.neverDepletes).toBe(true);
    expect(r.moneyLastsMonths).toBe(Infinity);
    expect(r.warnings.some((w) => w.code === 'neverUsedUp')).toBe(true);
  });

  it('duration with step-up uses simulation and matches solve for corpus', () => {
    const r = calculateSwp({
      ...base,
      mode: 'duration',
      corpus: 3_000_000,
      withdrawal: 25_000,
      withdrawalStepUpPct: 5,
    });
    expect(r.neverDepletes).toBe(false);
    const c = calculateSwp({ ...base, mode: 'corpus', withdrawal: 25_000, withdrawalStepUpPct: 5, years: r.years });
    expect(Math.abs(c.corpus - 3_000_000)).toBeLessThan(25_000 * 3);
  });

  it('duration with step-up that never runs out', () => {
    const r = calculateSwp({
      ...base,
      mode: 'duration',
      corpus: 50_000_000,
      withdrawal: 10_000,
      withdrawalStepUpPct: 1,
    });
    expect(r.neverDepletes).toBe(true);
  });

  it('duration with zero rate', () => {
    const r = calculateSwp({ ...base, mode: 'duration', annualReturn: 0, corpus: 1_000_000, withdrawal: 10_000 });
    expect(r.fullWithdrawals).toBe(100);
  });

  it('duration with start timing', () => {
    const r = calculateSwp({ ...base, mode: 'duration', timing: 'start', corpus: 2_000_000, withdrawal: 25_000 });
    const e = calculateSwp({ ...base, mode: 'duration', timing: 'end', corpus: 2_000_000, withdrawal: 25_000 });
    expect(r.moneyLastsMonths).toBeLessThan(e.moneyLastsMonths);
  });

  it('start timing runs out cleanly', () => {
    const r = calculateSwp({ ...base, timing: 'start', corpus: 500_000, withdrawal: 40_000, years: 5 });
    expect(r.lastsFullPeriod).toBe(false);
    expect(r.finalPayout).toBeGreaterThan(0);
  });

  it('closed-form growing annuity agrees with the loop', () => {
    for (const timing of ['end', 'start'] as const) {
      for (const g of [0, 5, 8]) {
        for (const rate of [0.004, 0]) {
          const a = pvOfUnitWithdrawals(rate, 120, 12, g, timing);
          const b = pvOfUnitWithdrawalsClosedForm(rate, 10, 12, g, timing);
          expect(a).toBeCloseTo(b, 6);
        }
      }
    }
    // q === 1 branch (step-up exactly cancels growth)
    const i = 0.05;
    expect(pvOfUnitWithdrawalsClosedForm(i, 4, 1, 5, 'end')).toBeCloseTo(pvOfUnitWithdrawals(i, 4, 1, 5, 'end'), 8);
  });

  it('keep principal with step-up lowers first withdrawal and warns if step-up >= return', () => {
    const flat = calculateSwp({ ...base, mode: 'keep', corpus: 10_000_000 });
    const stepped = calculateSwp({ ...base, mode: 'keep', corpus: 10_000_000, withdrawalStepUpPct: 3 });
    expect(stepped.withdrawal).toBeCloseTo(flat.withdrawal / 2, 4);
    const bad = calculateSwp({ ...base, mode: 'keep', corpus: 10_000_000, withdrawalStepUpPct: 7 });
    expect(bad.warnings.some((w) => w.code === 'stepUpTooHigh')).toBe(true);
    expect(bad.withdrawal).toBe(0);
    const start = calculateSwp({ ...base, mode: 'keep', timing: 'start', corpus: 10_000_000 });
    expect(start.finalBalance).toBeCloseTo(10_000_000, 2);
  });

  it('tax on returns and inflation', () => {
    const taxed = calculateSwp({ ...base, taxOnReturnsPct: 20, inflationPct: 6 });
    const plain = calculateSwp(base);
    expect(taxed.totalReturns).toBeLessThan(plain.totalReturns);
    expect(taxed.finalBalanceReal).toBeLessThan(taxed.finalBalance);
  });

  it('other frequencies', () => {
    for (const frequency of ['quarterly', 'halfYearly', 'annual'] as const) {
      const r = calculateSwp({ ...base, frequency, withdrawal: 100_000, corpus: 5_000_000, years: 10 });
      expect(r.schedule.length).toBeLessThanOrEqual(r.periodsPerYear * 10);
      expect(r.yearlyPlan.length).toBeGreaterThan(0);
      expect(r.yearlyCalendar.length).toBeGreaterThan(0);
    }
  });

  it('flags unrealistic returns and big withdrawals', () => {
    const r = calculateSwp({ ...base, annualReturn: 25, withdrawal: 1_000_000, corpus: 500_000 });
    expect(r.warnings.some((w) => w.code === 'unrealisticReturn')).toBe(true);
    expect(r.warnings.some((w) => w.code === 'withdrawalAboveCorpus')).toBe(true);
  });

  it('splitMonths', () => {
    expect(splitMonths(101.4)).toEqual({ years: 8, months: 5 });
  });

  it('schema validates and rejects', () => {
    expect(swpInputSchema.safeParse(base).success).toBe(true);
    expect(swpInputSchema.safeParse({ ...base, years: 0 }).success).toBe(false);
    expect(swpInputSchema.safeParse({ ...base, startDate: 'x' }).success).toBe(false);
  });
});

describe('SWP properties', () => {
  const cases: Partial<SwpInput>[] = [];
  for (const mode of ['useUp', 'keep', 'corpus', 'duration', 'withdrawal'] as const)
    for (const annualReturn of [0, 3, 8, 15])
      for (const timing of ['end', 'start'] as const)
        for (const frequency of ['monthly', 'quarterly', 'annual'] as const)
          for (const withdrawalStepUpPct of [0, 4])
            cases.push({ mode, annualReturn, timing, frequency, withdrawalStepUpPct });

  it('never negative, and flows balance', () => {
    for (const c of cases) {
      const r = calculateSwp({ ...base, taxOnReturnsPct: 10, ...c });
      for (const p of r.schedule) {
        expect(p.closingBalance).toBeGreaterThanOrEqual(0);
        expect(p.withdrawal).toBeGreaterThanOrEqual(0);
      }
      expect(Number.isFinite(r.corpus) && Number.isFinite(r.withdrawal)).toBe(true);
      expect(r.totalWithdrawn + r.finalBalance).toBeCloseTo(r.corpus + r.totalReturns, 4);
    }
  });

  it('handles very large and very small inputs', () => {
    const big = calculateSwp({ ...base, corpus: 1e12, withdrawal: 1e9, years: 60 });
    expect(Number.isFinite(big.finalBalance)).toBe(true);
    const small = calculateSwp({ ...base, corpus: 1, withdrawal: 1, years: 1 });
    expect(Number.isFinite(small.finalBalance)).toBe(true);
    const zero = calculateSwp({ ...base, annualReturn: 0, mode: 'corpus', withdrawal: 1000, years: 5 });
    expect(zero.corpus).toBeCloseTo(60_000, 6);
  });
});
