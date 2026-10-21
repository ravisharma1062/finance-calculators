export type RateMethod = 'effective' | 'nominal';
export type Frequency = 'monthly' | 'quarterly' | 'halfYearly' | 'annual';

export const FREQUENCIES = ['monthly', 'quarterly', 'halfYearly', 'annual'] as const;
export const RATE_METHODS = ['effective', 'nominal'] as const;

export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  monthly: 12,
  quarterly: 4,
  halfYearly: 2,
  annual: 1,
};

/**
 * Convert a yearly rate (in percent) to the rate for one period.
 * - effective: the yearly rate is the real yearly growth (like CAGR): (1 + r)^(1/n) - 1
 * - nominal:   the yearly rate is "compounded n times a year": r / n
 */
export function periodRate(annualPct: number, periodsPerYear: number, method: RateMethod = 'effective'): number {
  const r = annualPct / 100;
  if (method === 'nominal') return r / periodsPerYear;
  return Math.pow(1 + r, 1 / periodsPerYear) - 1;
}

/** Same as periodRate but takes a named frequency. */
export function periodRateFor(annualPct: number, frequency: Frequency, method: RateMethod = 'effective'): number {
  return periodRate(annualPct, PERIODS_PER_YEAR[frequency], method);
}

/** The real yearly growth that results from a period rate. */
export function effectiveAnnualPct(periodRateValue: number, periodsPerYear: number): number {
  return (Math.pow(1 + periodRateValue, periodsPerYear) - 1) * 100;
}

/** Future value of 1 after `n` periods. */
export const growth = (i: number, n: number): number => Math.pow(1 + i, n);

/** Present value of an ordinary annuity of 1 per period (works for i = 0). */
export function annuityFactor(i: number, n: number): number {
  if (Math.abs(i) < 1e-12) return n;
  return (1 - Math.pow(1 + i, -n)) / i;
}

/** Future value of an ordinary annuity of 1 per period (works for i = 0). */
export function fvAnnuityFactor(i: number, n: number): number {
  if (Math.abs(i) < 1e-12) return n;
  return (Math.pow(1 + i, n) - 1) / i;
}
