import { z } from 'zod';
import { FREQUENCIES, PERIODS_PER_YEAR, RATE_METHODS, periodRate } from './rates';
import { addMonths, collect, isoDate, todayIso, unrealisticReturn, type Warning } from './common';

export const SWP_MODES = ['useUp', 'keep', 'corpus', 'duration', 'withdrawal'] as const;
export type SwpMode = (typeof SWP_MODES)[number];

export const swpInputSchema = z.object({
  mode: z.enum(SWP_MODES),
  corpus: z.number().min(1).max(1e12),
  withdrawal: z.number().min(1).max(1e11),
  frequency: z.enum(FREQUENCIES),
  years: z.number().min(1).max(60),
  annualReturn: z.number().min(0).max(50),
  rateMethod: z.enum(RATE_METHODS),
  timing: z.enum(['end', 'start']),
  withdrawalStepUpPct: z.number().min(0).max(50),
  inflationPct: z.number().min(0).max(30),
  taxOnReturnsPct: z.number().min(0).max(60),
  startDate: isoDate,
});
export type SwpInput = z.infer<typeof swpInputSchema>;

export const swpDefaults: SwpInput = {
  mode: 'useUp',
  corpus: 2_000_000,
  withdrawal: 25_000,
  frequency: 'monthly',
  years: 10,
  annualReturn: 8,
  rateMethod: 'effective',
  timing: 'end',
  withdrawalStepUpPct: 0,
  inflationPct: 0,
  taxOnReturnsPct: 0,
  startDate: todayIso(),
};

export interface SwpPeriod {
  index: number;
  date: string;
  openingBalance: number;
  returns: number;
  withdrawal: number;
  closingBalance: number;
  /** true when the balance was too small for a full withdrawal and the rest was paid out */
  partial: boolean;
}

export interface SwpYearRow {
  year: number;
  label: string;
  openingBalance: number;
  withdrawn: number;
  returns: number;
  closingBalance: number;
  cumulativeWithdrawn: number;
  cumulativeReturns: number;
}

export interface SwpResult {
  mode: SwpMode;
  /** the values actually used (solved values filled in) */
  corpus: number;
  withdrawal: number;
  years: number;
  periodsPerYear: number;
  periodRate: number;
  /** money lasts this many months (Infinity when never used up) */
  moneyLastsMonths: number;
  neverDepletes: boolean;
  lastsFullPeriod: boolean;
  /** number of complete withdrawals paid */
  fullWithdrawals: number;
  /** sum of the complete withdrawals */
  totalWithdrawn: number;
  /** returns earned up to the last complete withdrawal */
  totalReturns: number;
  /** balance after the last complete withdrawal */
  finalBalance: number;
  /** last partial payout when the balance was too small for a full withdrawal (0 otherwise) */
  finalPayout: number;
  /** final balance in today's money (needs inflationPct) */
  finalBalanceReal: number;
  lastWithdrawal: number;
  schedule: SwpPeriod[];
  yearlyPlan: SwpYearRow[];
  yearlyCalendar: SwpYearRow[];
  warnings: Warning[];
}

const MAX_YEARS = 100;

/** Net rate per period after tax on returns. */
export function netPeriodRate(
  input: Pick<SwpInput, 'annualReturn' | 'rateMethod' | 'frequency' | 'taxOnReturnsPct'>,
): number {
  const ppy = PERIODS_PER_YEAR[input.frequency];
  return periodRate(input.annualReturn, ppy, input.rateMethod) * (1 - input.taxOnReturnsPct / 100);
}

/** Withdrawal amount for a given period index (0-based) with yearly step-up. */
function withdrawalAt(base: number, stepUpPct: number, index: number, ppy: number): number {
  return base * Math.pow(1 + stepUpPct / 100, Math.floor(index / ppy));
}

/** Present value of the withdrawal stream when the first withdrawal is 1. */
export function pvOfUnitWithdrawals(
  i: number,
  periods: number,
  ppy: number,
  stepUpPct: number,
  timing: 'end' | 'start',
): number {
  let pv = 0;
  for (let k = 0; k < periods; k++) {
    const w = withdrawalAt(1, stepUpPct, k, ppy);
    const exponent = timing === 'end' ? k + 1 : k;
    pv += w / Math.pow(1 + i, exponent);
  }
  return pv;
}

/**
 * Closed-form value of `pvOfUnitWithdrawals`. Works when the plan has a whole number of years.
 * Used to cross-check the loop in tests.
 */
export function pvOfUnitWithdrawalsClosedForm(
  i: number,
  years: number,
  ppy: number,
  stepUpPct: number,
  timing: 'end' | 'start',
): number {
  const g = stepUpPct / 100;
  const yearFactor = (n: number) => (Math.abs(i) < 1e-12 ? n : (1 - Math.pow(1 + i, -n)) / i);
  const annuityOneYear = yearFactor(ppy) * (timing === 'start' ? 1 + i : 1);
  const q = (1 + g) / Math.pow(1 + i, ppy);
  const sum = Math.abs(q - 1) < 1e-12 ? years : (1 - Math.pow(q, years)) / (1 - q);
  return annuityOneYear * sum;
}

/** Simulate a withdrawal plan period by period. */
export function simulateSwp(args: {
  corpus: number;
  withdrawal: number;
  periods: number;
  ppy: number;
  rate: number;
  timing: 'end' | 'start';
  stepUpPct: number;
  startDate: string;
}): SwpPeriod[] {
  const { corpus, withdrawal, periods, ppy, rate, timing, stepUpPct, startDate } = args;
  const monthsPerPeriod = 12 / ppy;
  const out: SwpPeriod[] = [];
  let balance = corpus;
  for (let k = 0; k < periods; k++) {
    const w = withdrawalAt(withdrawal, stepUpPct, k, ppy);
    const date = addMonths(
      startDate,
      Math.round(k * monthsPerPeriod) + (timing === 'end' ? Math.round(monthsPerPeriod) : 0),
    );
    const opening = balance;
    let returns: number;
    let paid: number;
    let closing: number;
    let partial = false;
    if (timing === 'end') {
      returns = opening * rate;
      const available = opening + returns;
      if (available + 1e-9 < w) {
        paid = available;
        closing = 0;
        partial = true;
      } else {
        paid = w;
        closing = available - w;
      }
    } else if (opening + 1e-9 < w) {
      paid = opening;
      returns = 0;
      closing = 0;
      partial = true;
    } else {
      returns = (opening - w) * rate;
      paid = w;
      closing = opening - w + returns;
    }
    if (!partial && closing < 1e-6) closing = 0;
    out.push({
      index: k + 1,
      date,
      openingBalance: opening,
      returns,
      withdrawal: paid,
      closingBalance: closing,
      partial,
    });
    balance = closing;
    if (partial || balance <= 0) break;
  }
  return out;
}

function summariseYears(schedule: SwpPeriod[], ppy: number, by: 'plan' | 'calendar'): SwpYearRow[] {
  const rows = new Map<number, SwpYearRow>();
  let cumW = 0;
  let cumR = 0;
  for (const p of schedule) {
    const key = by === 'plan' ? Math.floor((p.index - 1) / ppy) + 1 : Number(p.date.slice(0, 4));
    let row = rows.get(key);
    if (!row) {
      row = {
        year: key,
        label: String(key),
        openingBalance: p.openingBalance,
        withdrawn: 0,
        returns: 0,
        closingBalance: p.closingBalance,
        cumulativeWithdrawn: 0,
        cumulativeReturns: 0,
      };
      rows.set(key, row);
    }
    row.withdrawn += p.withdrawal;
    row.returns += p.returns;
    row.closingBalance = p.closingBalance;
    cumW += p.withdrawal;
    cumR += p.returns;
    row.cumulativeWithdrawn = cumW;
    row.cumulativeReturns = cumR;
  }
  return [...rows.values()];
}

/** Years and months text pieces from a month count. */
export function splitMonths(totalMonths: number): { years: number; months: number } {
  const whole = Math.floor(totalMonths + 1e-9);
  return { years: Math.floor(whole / 12), months: whole % 12 };
}

export function calculateSwp(input: SwpInput): SwpResult {
  const ppy = PERIODS_PER_YEAR[input.frequency];
  const monthsPerPeriod = 12 / ppy;
  const i = netPeriodRate(input);
  const rate = input.annualReturn / 100;
  const g = input.withdrawalStepUpPct / 100;
  const warnings: Warning[] = [];
  const horizon = Math.max(1, Math.round(input.years * ppy));
  let corpus = input.corpus;
  let withdrawal = input.withdrawal;
  let years = input.years;
  let periods = horizon;
  let neverFromSolve = false;

  switch (input.mode) {
    case 'keep': {
      // Withdraw only the growth: corpus x period rate. A yearly step-up reduces the first withdrawal.
      const base = (corpus * i) / (input.timing === 'start' ? 1 + i : 1);
      const stepScale = g > 0 && rate > 0 ? Math.max(0, (rate - g) / rate) : 1;
      withdrawal = base * stepScale;
      if (g > 0 && g >= rate)
        warnings.push({
          code: 'stepUpTooHigh',
          params: { stepUp: input.withdrawalStepUpPct, rate: input.annualReturn },
        });
      break;
    }
    case 'corpus': {
      corpus = withdrawal * pvOfUnitWithdrawals(i, horizon, ppy, input.withdrawalStepUpPct, input.timing);
      break;
    }
    case 'withdrawal': {
      withdrawal = corpus / pvOfUnitWithdrawals(i, horizon, ppy, input.withdrawalStepUpPct, input.timing);
      break;
    }
    case 'duration': {
      const growthFactor = input.timing === 'start' ? 1 + i : 1;
      const p = withdrawal / growthFactor;
      if (input.withdrawalStepUpPct === 0) {
        if (i <= 0) {
          periods = Math.ceil(corpus / withdrawal);
        } else if (p > corpus * i) {
          const n = -Math.log(1 - (corpus * i) / p) / Math.log(1 + i);
          periods = Math.max(1, Math.ceil(n));
        } else {
          neverFromSolve = true;
        }
      } else {
        const cap = MAX_YEARS * ppy;
        const probe = simulateSwp({
          corpus,
          withdrawal,
          periods: cap,
          ppy,
          rate: i,
          timing: input.timing,
          stepUpPct: input.withdrawalStepUpPct,
          startDate: input.startDate,
        });
        const last = probe[probe.length - 1];
        if (last && (last.partial || last.closingBalance === 0)) periods = probe.length;
        else neverFromSolve = true;
      }
      if (neverFromSolve) periods = horizon;
      years = periods / ppy;
      break;
    }
    default:
      break;
  }

  const schedule = simulateSwp({
    corpus,
    withdrawal,
    periods,
    ppy,
    rate: i,
    timing: input.timing,
    stepUpPct: input.withdrawalStepUpPct,
    startDate: input.startDate,
  });

  const last = schedule[schedule.length - 1];
  const partialRow = last?.partial ? last : undefined;
  const fullRows = partialRow ? schedule.slice(0, -1) : schedule;
  const fullWithdrawals = fullRows.length;
  const totalWithdrawn = fullRows.reduce((s, p) => s + p.withdrawal, 0);
  const totalReturns = fullRows.reduce((s, p) => s + p.returns, 0);
  const lastFull = fullRows[fullRows.length - 1];
  const finalBalance = lastFull ? lastFull.closingBalance : corpus;
  const finalPayout = partialRow ? partialRow.withdrawal : 0;

  const lastsFullPeriod = !partialRow && fullWithdrawals >= periods - 0;
  let moneyLastsPeriods = fullWithdrawals;
  if (partialRow) {
    const wNext = withdrawalAt(withdrawal, input.withdrawalStepUpPct, fullWithdrawals, ppy);
    moneyLastsPeriods += wNext > 0 ? Math.min(1, finalPayout / wNext) : 0;
  }
  const neverDepletes = input.mode === 'duration' ? neverFromSolve : false;
  let moneyLastsMonths = moneyLastsPeriods * monthsPerPeriod;
  if (neverDepletes) moneyLastsMonths = Infinity;

  if (neverDepletes) {
    warnings.push({ code: 'neverUsedUp' });
  } else if (partialRow && input.mode !== 'duration') {
    const { years: ly, months: lm } = splitMonths(moneyLastsMonths);
    const planned = splitMonths(periods * monthsPerPeriod);
    warnings.push({
      code: 'endsEarly',
      params: { years: ly, months: lm, plannedYears: planned.years, plannedMonths: planned.months },
    });
  }
  if (input.mode === 'useUp' && !partialRow && i * corpus >= withdrawal && input.withdrawalStepUpPct === 0) {
    warnings.push({ code: 'growthCoversWithdrawal' });
  }
  const unreal = unrealisticReturn(input.annualReturn);
  if (unreal) warnings.push(unreal);
  if (input.mode !== 'keep' && withdrawal * ppy > corpus) warnings.push({ code: 'withdrawalAboveCorpus' });

  const inflation = input.inflationPct / 100;
  const elapsedYears = (fullWithdrawals * monthsPerPeriod) / 12;
  const finalBalanceReal = finalBalance / Math.pow(1 + inflation, elapsedYears);
  const lastWithdrawal = lastFull ? lastFull.withdrawal : 0;

  return {
    mode: input.mode,
    corpus,
    withdrawal,
    years,
    periodsPerYear: ppy,
    periodRate: i,
    moneyLastsMonths,
    neverDepletes,
    lastsFullPeriod: neverDepletes ? true : lastsFullPeriod,
    fullWithdrawals,
    totalWithdrawn,
    totalReturns,
    finalBalance,
    finalPayout,
    finalBalanceReal,
    lastWithdrawal,
    schedule,
    yearlyPlan: summariseYears(schedule, ppy, 'plan'),
    yearlyCalendar: summariseYears(schedule, ppy, 'calendar'),
    warnings: collect(...warnings),
  };
}
