import type { YearRow } from '@app/calc-core';
import type {
  CalcDef,
  ChartSpec,
  DateFieldDef,
  NumberFieldDef,
  Presentation,
  SelectFieldDef,
  TableSpec,
  Unit,
  Values,
} from './types';
import type { ZodType } from 'zod';

/**
 * Dates that depend on "today" cannot be known at build time. Pages start with this fixed date so the
 * pre-built HTML and the first browser render match, then switch to the real date after loading.
 */
export const PLACEHOLDER_DATE = '2026-01-01';

export const num = (
  name: string,
  min: number,
  max: number,
  step: number,
  unit: Unit,
  extra: Partial<NumberFieldDef> = {},
): NumberFieldDef => ({ kind: 'number', name, min, max, step, unit, ...extra });

export const sel = (name: string, options: string[], extra: Partial<SelectFieldDef> = {}): SelectFieldDef => ({
  kind: 'select',
  name,
  options,
  ...extra,
});

export const date = (name: string, extra: Partial<DateFieldDef> = {}): DateFieldDef => ({
  kind: 'date',
  name,
  ...extra,
});

export const hiddenNum = (name: string): NumberFieldDef => ({
  kind: 'number',
  name,
  min: 0,
  max: 0,
  step: 1,
  unit: 'none',
  hidden: true,
});

/** Build a calculator definition with typed calculate/present functions. */
export function define<I extends object, R>(def: {
  slug: string;
  category: CalcDef['category'];
  icon: string;
  related: string[];
  schema: ZodType<I>;
  defaults: I;
  fields: CalcDef['fields'];
  modeField?: string;
  rulesMap?: Record<string, string>;
  calculate: (input: I) => R;
  present: (result: R, input: I) => Presentation;
}): CalcDef {
  return def as unknown as CalcDef;
}

export const accumulationTable = (rows: YearRow[], id = 'yearly'): TableSpec => ({
  id,
  labelKey: 'tables.yearly',
  columns: [
    { key: 'year', labelKey: 'year', kind: 'number' },
    { key: 'invested', labelKey: 'invested', kind: 'currency' },
    { key: 'returns', labelKey: 'returns', kind: 'currency' },
    { key: 'balance', labelKey: 'balance', kind: 'currency' },
  ],
  rows: rows.map((r) => ({
    year: r.year,
    invested: r.cumulativeFlow,
    returns: r.cumulativeReturns,
    balance: r.closing,
  })),
});

export const accumulationChart = (rows: YearRow[], opening = 0): ChartSpec => ({
  xKey: 'year',
  xLabelKey: 'year',
  series: [
    { key: 'balance', labelKey: 'balance', type: 'area' },
    { key: 'invested', labelKey: 'invested', type: 'line' },
  ],
  rows: [
    { year: 0, balance: opening, invested: opening },
    ...rows.map((r) => ({ year: r.year, balance: r.closing, invested: opening + r.cumulativeFlow })),
  ],
});

export const asValues = (v: object): Values => v as Values;
