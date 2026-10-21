import type { ZodType } from 'zod';
import type { Warning } from '@app/calc-core';
import type { CountryConfig } from '@config/site';

export type Category = 'invest' | 'withdraw' | 'loans' | 'retirement' | 'tax' | 'property';
export const CATEGORIES: Category[] = ['invest', 'withdraw', 'loans', 'retirement', 'tax', 'property'];

export type Unit = 'currency' | 'percent' | 'years' | 'months' | 'age' | 'days' | 'none';

export type Values = Record<string, number | string>;

interface FieldBase {
  name: string;
  /** shown only in these modes (when the calculator has a mode field) */
  modes?: string[];
  advanced?: boolean;
  /** not shown: the value comes from defaults or country rules */
  hidden?: boolean;
}

export interface NumberFieldDef extends FieldBase {
  kind: 'number';
  unit: Unit;
  min: number;
  max: number;
  step: number;
}
export interface SelectFieldDef extends FieldBase {
  kind: 'select';
  options: string[];
}
export interface DateFieldDef extends FieldBase {
  kind: 'date';
}
export type FieldDef = NumberFieldDef | SelectFieldDef | DateFieldDef;

export type ValueKind = 'currency' | 'percent' | 'duration' | 'number' | 'text' | 'years' | 'age' | 'days';

export interface ResultCard {
  /** key in the `labels` messages */
  id: string;
  value: number | string;
  kind: ValueKind;
  tone?: 'primary' | 'good' | 'warn' | 'neutral';
}

export interface ChartSeries {
  key: string;
  labelKey: string;
  type: 'area' | 'bar' | 'line';
  stack?: string;
}
export interface ChartSpec {
  xKey: string;
  xLabelKey: string;
  series: ChartSeries[];
  rows: Record<string, number | string>[];
}

export interface TableColumn {
  key: string;
  labelKey: string;
  kind: ValueKind;
}
export interface TableSpec {
  id: string;
  labelKey: string;
  columns: TableColumn[];
  rows: Record<string, number | string>[];
}

export interface Presentation {
  cards: ResultCard[];
  warnings: Warning[];
  chart?: ChartSpec;
  tables: TableSpec[];
}

export interface CalcDef {
  slug: string;
  category: Category;
  /** lucide icon name */
  icon: string;
  /** related calculators, by slug */
  related: string[];
  schema: ZodType;
  defaults: Values;
  fields: FieldDef[];
  /** name of the select field shown as tabs */
  modeField?: string;
  /** maps a country rule key to an input name */
  rulesMap?: Record<string, string>;
  calculate: (values: Values) => unknown;
  present: (result: unknown, values: Values) => Presentation;
}

export interface ResolvedCalc {
  def: CalcDef;
  country: CountryConfig;
  defaults: Values;
  fields: FieldDef[];
}
