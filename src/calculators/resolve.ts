import type { CountryConfig } from '@config/site';
import { calculatorBySlug, calculators } from './registry';
import type { CalcDef, FieldDef, ResolvedCalc, Values } from './types';

/** Round to a "nice" number (1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10 times a power of ten). */
export function niceRound(x: number): number {
  if (x <= 0) return 0;
  const m = Math.pow(10, Math.floor(Math.log10(x)));
  const r = x / m;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
  let best = steps[0]!;
  for (const s of steps) if (Math.abs(s - r) < Math.abs(best - r)) best = s;
  return +(best * m).toPrecision(6);
}

function scaleField(f: FieldDef, scale: number): FieldDef {
  if (f.kind !== 'number' || f.unit !== 'currency' || scale === 1) return f;
  return {
    ...f,
    min: f.min === 0 ? 0 : niceRound(f.min * scale),
    max: niceRound(f.max * scale),
    step: Math.max(1, niceRound(f.step * scale)),
  };
}

/** Defaults and fields for a calculator in one country: amounts scaled, rules and overrides applied. */
export function resolveCalc(def: CalcDef, country: CountryConfig): ResolvedCalc {
  const scale = country.amountScale;
  const fields = def.fields.map((f) => scaleField(f, scale));
  const defaults: Values = { ...def.defaults };
  for (const f of def.fields) {
    if (f.kind === 'number' && f.unit === 'currency' && scale !== 1) {
      const v = defaults[f.name];
      if (typeof v === 'number') defaults[f.name] = v === 0 ? 0 : niceRound(v * scale);
    }
  }
  const rules = country.taxRules[def.slug];
  if (rules && def.rulesMap) {
    for (const [ruleKey, inputName] of Object.entries(def.rulesMap)) {
      const v = rules[ruleKey];
      if (v !== undefined) defaults[inputName] = v;
    }
  }
  Object.assign(defaults, country.overrides[def.slug] ?? {});
  // keep every default inside its slider range, so the slider and the number always agree
  for (const f of fields) {
    const v = defaults[f.name];
    if (f.kind === 'number' && !f.hidden && typeof v === 'number') {
      defaults[f.name] = Math.min(f.max, Math.max(f.min, v));
    }
  }
  return { def, country, defaults, fields };
}

export function calculatorsForCountry(country: CountryConfig): CalcDef[] {
  return country.calculators.map((s) => calculatorBySlug(s)).filter((c): c is CalcDef => !!c);
}

export function allCalculatorSlugs(): string[] {
  return calculators.map((c) => c.slug);
}
