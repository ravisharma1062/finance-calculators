import { z } from 'zod';

/** A warning is a code plus params. The UI turns it into text (no UI text in core). */
export interface Warning {
  code: string;
  params?: Record<string, number | string>;
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add whole months to an ISO date (UTC), clamping the day to the end of the month. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface YearRow {
  year: number;
  label: string;
  opening: number;
  /** money put in during the year (deposits, EMI, withdrawals depending on calculator) */
  flow: number;
  returns: number;
  closing: number;
  cumulativeFlow: number;
  cumulativeReturns: number;
}

export const unrealisticReturn = (pct: number): Warning | null =>
  pct > 20 ? { code: 'unrealisticReturn', params: { rate: pct } } : null;

export function collect(...w: (Warning | null | false | undefined)[]): Warning[] {
  return w.filter((x): x is Warning => !!x);
}

export interface FlowStep {
  opening: number;
  flow: number;
  returns: number;
  closing: number;
}

/** Group a list of steps into plan years. */
export function yearRows(steps: FlowStep[], periodsPerYear: number): YearRow[] {
  const rows: YearRow[] = [];
  let cumFlow = 0;
  let cumReturns = 0;
  steps.forEach((s, idx) => {
    const year = Math.floor(idx / periodsPerYear) + 1;
    let row = rows[rows.length - 1];
    if (!row || row.year !== year) {
      row = {
        year,
        label: String(year),
        opening: s.opening,
        flow: 0,
        returns: 0,
        closing: s.closing,
        cumulativeFlow: 0,
        cumulativeReturns: 0,
      };
      rows.push(row);
    }
    row.flow += s.flow;
    row.returns += s.returns;
    row.closing = s.closing;
    cumFlow += s.flow;
    cumReturns += s.returns;
    row.cumulativeFlow = cumFlow;
    row.cumulativeReturns = cumReturns;
  });
  return rows;
}
