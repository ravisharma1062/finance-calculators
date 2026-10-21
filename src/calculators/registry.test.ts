import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import enCalc from '../../messages/en.calculators.json';
import { countries, locales, parseLocale } from '@config/site';
import { calculatorBySlug, calculators } from './registry';
import { calculatorsForCountry, niceRound, resolveCalc } from './resolve';
import type { CalcDef, Values } from './types';

type Dict = Record<string, unknown>;
const messages = en as Dict;
const calcMessages = enCalc as Record<string, Dict>;
const has = (root: Dict, path: string): boolean => {
  let cur: unknown = root;
  for (const part of path.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return false;
    cur = (cur as Dict)[part];
  }
  return true;
};

/** Every value of the mode field, so each mode is exercised. */
function variants(def: CalcDef, defaults: Values): Values[] {
  const mf = def.fields.find((f) => f.name === def.modeField);
  if (!mf || mf.kind !== 'select') return [defaults];
  return mf.options.map((o) => ({ ...defaults, [mf.name]: o }));
}

describe('calculator registry', () => {
  it('has unique slugs and every country slug exists', () => {
    const slugs = calculators.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of Object.values(countries)) {
      for (const s of c.calculators) expect(calculatorBySlug(s), `${c.code}:${s}`).toBeDefined();
    }
  });

  it('every calculator is offered somewhere, and related links exist', () => {
    const offered = new Set(Object.values(countries).flatMap((c) => c.calculators));
    for (const c of calculators) {
      expect(offered.has(c.slug), c.slug).toBe(true);
      for (const r of c.related) expect(calculatorBySlug(r), `${c.slug} -> ${r}`).toBeDefined();
    }
  });

  for (const country of Object.values(countries)) {
    describe(`country ${country.code}`, () => {
      for (const def of calculatorsForCountry(country)) {
        it(`${def.slug}: defaults are valid and results are finite`, () => {
          const resolved = resolveCalc(def, country);
          for (const values of variants(def, resolved.defaults)) {
            const parsed = def.schema.safeParse(values);
            expect(parsed.success, `${def.slug} ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
            if (!parsed.success) continue;
            const input = parsed.data as Values;
            const p = def.present(def.calculate(input), input);
            expect(p.cards.length).toBeGreaterThan(0);
            for (const c of p.cards) {
              if (typeof c.value === 'number') {
                expect(Number.isNaN(c.value), `${def.slug}.${c.id}`).toBe(false);
                if (c.kind !== 'duration') expect(Number.isFinite(c.value), `${def.slug}.${c.id}`).toBe(true);
              }
            }
            for (const t of p.tables) {
              expect(t.rows.length).toBeGreaterThan(0);
              for (const row of t.rows)
                for (const col of t.columns) expect(row[col.key], `${def.slug}.${t.id}.${col.key}`).toBeDefined();
            }
            for (const r of p.chart?.rows ?? [])
              for (const v of Object.values(r)) expect(Number.isFinite(Number(v))).toBe(true);
          }
        });

        it(`${def.slug}: default values sit inside their slider range`, () => {
          const resolved = resolveCalc(def, country);
          for (const f of resolved.fields) {
            if (f.kind !== 'number' || f.hidden) continue;
            const v = resolved.defaults[f.name] as number;
            expect(v, `${def.slug}.${f.name}`).toBeGreaterThanOrEqual(f.min);
            expect(v, `${def.slug}.${f.name}`).toBeLessThanOrEqual(f.max);
            expect(f.min).toBeLessThan(f.max);
            expect(f.step).toBeGreaterThan(0);
          }
        });
      }
    });
  }

  it('SWP defaults reproduce the "money ends early" warning in the page model', () => {
    const def = calculatorBySlug('swp')!;
    const r = resolveCalc(def, countries.in!);
    const input = def.schema.parse({ ...r.defaults, annualReturn: 6, years: 15 }) as Values;
    const p = def.present(def.calculate(input), input);
    expect(p.warnings.map((w) => w.code)).toContain('endsEarly');
    expect(p.cards[0]!.id).toBe('moneyLasts');
    expect(p.cards[0]!.tone).toBe('warn');
  });
});

describe('messages', () => {
  it('has copy for every calculator', () => {
    for (const def of calculators) {
      const m = calcMessages[def.slug];
      expect(m, def.slug).toBeDefined();
      for (const key of ['name', 'short', 'metaTitle', 'metaDescription', 'intro', 'howItWorks', 'formula']) {
        expect(typeof m![key], `${def.slug}.${key}`).toBe('string');
        expect((m![key] as string).length).toBeGreaterThan(5);
      }
      const faq = m!.faq as { q: string; a: string }[];
      expect(faq.length).toBeGreaterThanOrEqual(2);
      expect(m!.metaDescription as string).toSatisfy((s: string) => s.length <= 200);
    }
  });

  it('has a label for every field, option, card, column, chart series and warning', () => {
    const missing: string[] = [];
    const need = (key: string, root: Dict = messages) => {
      if (!has(root, key)) missing.push(key);
    };
    for (const country of Object.values(countries)) {
      for (const def of calculatorsForCountry(country)) {
        const resolved = resolveCalc(def, country);
        const calcOwn = (calcMessages[def.slug]?.fields ?? {}) as Dict;
        for (const f of def.fields) {
          if (f.hidden) continue;
          const ownKeys = Object.keys(calcOwn).filter((k) => k === f.name || k.startsWith(`${f.name}_`));
          if (ownKeys.length === 0) need(`fields.${f.name}`);
          if (f.kind === 'select') for (const o of f.options) need(`options.${f.name}.${o}`);
        }
        for (const values of variants(def, resolved.defaults)) {
          const parsed = def.schema.safeParse(values);
          if (!parsed.success) continue;
          const input = parsed.data as Values;
          const p = def.present(def.calculate(input), input);
          for (const c of p.cards) need(`labels.${c.id}`);
          for (const t of p.tables) {
            need(t.labelKey);
            for (const c of t.columns) need(`labels.${c.labelKey}`);
          }
          for (const s of p.chart?.series ?? []) need(`labels.${s.labelKey}`);
          if (p.chart) need(`labels.${p.chart.xLabelKey}`);
          for (const w of p.warnings) need(`warnings.${w.code}`);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('knows all schema warning codes', () => {
    for (const code of [
      'endsEarly',
      'neverUsedUp',
      'stepUpTooHigh',
      'unrealisticReturn',
      'withdrawalAboveCorpus',
      'goalAlreadyMet',
      'highWithdrawalRate',
      'fireNotReached',
      'highInterestRate',
      'prepaymentClearsLoan',
      'depositAboveLimit',
      'ppfMinimumLockIn',
      'annuityBelowMinimum',
      'shortHorizon',
      'rentVeryHigh',
      'noDelay',
      'growthCoversWithdrawal',
    ]) {
      expect(has(messages, `warnings.${code}`), code).toBe(true);
    }
  });

  it('every locale maps to a known country', () => {
    for (const l of locales) expect(parseLocale(l).country.code).toBe(l.split('-')[1]);
  });
});

describe('country rules', () => {
  it('every rule has a date and a source', () => {
    for (const c of Object.values(countries)) {
      for (const [name, rule] of Object.entries(c.taxRules)) {
        expect(rule.lastUpdated, `${c.code}.${name}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(rule.sourceUrl, `${c.code}.${name}`).toMatch(/^https:\/\//);
      }
    }
  });

  it('applies country rules and overrides to defaults', () => {
    const ppf = resolveCalc(calculatorBySlug('ppf')!, countries.in!);
    expect(ppf.defaults.annualRate).toBe(7.1);
    expect(ppf.defaults.yearlyLimit).toBe(150000);
    const k = resolveCalc(calculatorBySlug('401k')!, countries.us!);
    expect(k.defaults.employerMatchPct).toBe(50);
    expect(k.defaults.yearlyLimit).toBe(23500);
    const sipp = resolveCalc(calculatorBySlug('sipp')!, countries.gb!);
    expect(sipp.defaults.governmentTopUpPct).toBe(25);
    const emiUs = resolveCalc(calculatorBySlug('emi')!, countries.us!);
    expect(emiUs.defaults.annualRate).toBe(6.5);
    expect(emiUs.defaults.tenureMonths).toBe(360);
  });

  it('scales amounts for other currencies', () => {
    const inSwp = resolveCalc(calculatorBySlug('swp')!, countries.in!);
    const usSwp = resolveCalc(calculatorBySlug('swp')!, countries.us!);
    expect(inSwp.defaults.corpus).toBe(2_000_000);
    expect(usSwp.defaults.corpus).toBe(25_000);
    expect(usSwp.defaults.withdrawal).toBe(300);
  });

  it('niceRound', () => {
    expect(niceRound(312.5)).toBe(300);
    expect(niceRound(25_000)).toBe(25_000);
    expect(niceRound(0)).toBe(0);
    expect(niceRound(0.0123)).toBeCloseTo(0.01, 6);
  });
});
