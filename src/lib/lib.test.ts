import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fireDefaults, fireInputSchema, swpDefaults, swpInputSchema } from '@app/calc-core';
import { absoluteUrl, countries } from '@config/site';
import { clientMessages, deepMerge, loadMessages } from '@/i18n/messages';
import { toCsv } from './csv';
import { pickLocale } from './detectLocale';
import { issuesToErrors } from './errors';
import { makeFormatters, monthsToParts } from './format';
import { getMarketData, getRate } from './marketData';
import { languageAlternates } from './seo';
import { deleteScenario, listScenarios, loadScenario, saveScenario } from './storage';
import { fromQuery, toQuery } from './urlState';
import { cn } from './utils';

describe('format', () => {
  const inFmt = makeFormatters('en-in', countries.in!);
  const usFmt = makeFormatters('en-us', countries.us!);
  const gbFmt = makeFormatters('en-gb', countries.gb!);

  it('uses lakh and crore grouping for India', () => {
    expect(inFmt.currency(2_500_000)).toBe('₹25,00,000');
    expect(inFmt.currency(10_000_000)).toBe('₹1,00,00,000');
    expect(inFmt.symbol).toBe('₹');
  });
  it('uses millions grouping elsewhere', () => {
    expect(usFmt.currency(2_500_000)).toBe('$2,500,000');
    expect(gbFmt.currency(2_500_000)).toBe('£2,500,000');
  });
  it('short forms', () => {
    expect(inFmt.currency(2_590_000, { compact: true })).toBe('₹25.9 L');
    expect(inFmt.currency(10_000_000, { compact: true })).toBe('₹1 Cr');
    expect(inFmt.currency(-12_345, { compact: true })).toBe('-₹12.35 K');
    expect(inFmt.currency(950, { compact: true })).toBe('₹950');
    expect(usFmt.currency(2_500_000, { compact: true })).toBe('$2.5M');
  });
  it('handles decimals, numbers, percent and non-finite values', () => {
    expect(inFmt.currency(1234.567, { decimals: 2 })).toBe('₹1,234.57');
    expect(inFmt.currency(Infinity)).toBe('-');
    expect(inFmt.number(1234567.891)).toBe('12,34,567.89');
    expect(inFmt.number(NaN)).toBe('-');
    expect(inFmt.percent(8.256)).toBe('8.26%');
    expect(inFmt.percent(NaN)).toBe('-');
  });
  it('monthsToParts', () => {
    expect(monthsToParts(101.9)).toEqual({ years: 8, months: 5 });
    expect(monthsToParts(0)).toEqual({ years: 0, months: 0 });
  });
});

describe('urlState', () => {
  const defaults = { corpus: 100, mode: 'useUp', rate: 8 };
  it('writes only changed values', () => {
    expect(toQuery(defaults, defaults)).toBe('');
    expect(toQuery({ ...defaults, corpus: 250, mode: 'keep' }, defaults)).toBe('corpus=250&mode=keep');
    expect(toQuery({ ...defaults, corpus: NaN }, defaults)).toBe('');
  });
  it('reads values back with the right types, ignoring unknown keys and bad numbers', () => {
    expect(fromQuery('?corpus=250&mode=keep&evil=1&rate=abc', defaults)).toEqual({ corpus: 250, mode: 'keep' });
    expect(fromQuery('corpus=', defaults)).toEqual({});
  });
  it('round-trips', () => {
    const v = { corpus: 1234.5, mode: 'duration', rate: 7.25 };
    expect({ ...defaults, ...fromQuery(toQuery(v, defaults), defaults) }).toEqual(v);
  });
});

describe('csv', () => {
  it('quotes values that need it and rounds numbers', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          [1.234, 'x,y'],
          [NaN, 'say "hi"'],
        ],
      ),
    ).toBe('a,b\r\n1.23,"x,y"\r\n,"say ""hi"""');
  });
});

describe('errors', () => {
  it('maps zod issues to translatable keys', () => {
    const r = swpInputSchema.safeParse({ ...swpDefaults, corpus: 0, years: 99, withdrawal: NaN, startDate: 'x' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const e = issuesToErrors(r.error);
    expect(e.corpus).toEqual({ key: 'min', params: { min: 1 } });
    expect(e.years).toEqual({ key: 'max', params: { max: 60 } });
    expect(e.withdrawal).toEqual({ key: 'required' });
    expect(e.startDate).toEqual({ key: 'invalidDate' });
  });
  it('uses the message of refinements', () => {
    const r = fireInputSchema.safeParse({ ...fireDefaults, retirementAge: 20 });
    if (r.success) throw new Error('should fail');
    expect(issuesToErrors(r.error).retirementAge).toEqual({ key: 'retirementAfterCurrent' });
  });
  it('flags whole-number rules and unknown issues', () => {
    const e1 = issuesToErrors(z.object({ n: z.number().int() }).safeParse({ n: 1.5 }).error!);
    expect(e1.n!.key).toBe('wholeNumber');
    const e2 = issuesToErrors(z.object({ n: z.enum(['a']) }).safeParse({ n: 'b' }).error!);
    expect(e2.n!.key).toBe('invalid');
  });
});

describe('detectLocale', () => {
  it('prefers a saved choice', () => {
    expect(pickLocale(['en-US'], 'hi-in')).toBe('hi-in');
    expect(pickLocale(['en-US'], 'xx-yy')).toBe('en-us');
  });
  it('matches browser languages', () => {
    expect(pickLocale(['en-GB'])).toBe('en-gb');
    expect(pickLocale(['en-AU'])).toBe('en-gb');
    expect(pickLocale(['en-CA'])).toBe('en-us');
    expect(pickLocale(['en-IN'])).toBe('en-in');
    expect(pickLocale(['en'])).toBe('en-in');
    expect(pickLocale(['hi'])).toBe('hi-in');
    expect(pickLocale(['hi-IN'])).toBe('hi-in');
    expect(pickLocale(['fr-FR', 'en-US'])).toBe('en-us');
    expect(pickLocale(['de'])).toBe('en-in');
    expect(pickLocale([])).toBe('en-in');
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  it('saves, lists, loads and deletes scenarios', () => {
    const a = saveScenario('swp', { corpus: 1 });
    const b = saveScenario('sip', { monthlyInvestment: 5 });
    expect(listScenarios()).toHaveLength(2);
    expect(listScenarios('swp').map((s) => s.id)).toEqual([a.id]);
    expect(loadScenario(b.id)?.inputs).toEqual({ monthlyInvestment: 5 });
    deleteScenario(a.id);
    expect(loadScenario(a.id)).toBeNull();
  });
  it('survives bad stored data', () => {
    localStorage.setItem('fincalc:scenarios:v1', '{oops');
    expect(listScenarios()).toEqual([]);
    localStorage.setItem('fincalc:scenarios:v1', '{"a":1}');
    expect(listScenarios()).toEqual([]);
  });
});

describe('marketData', () => {
  it('returns the static data with a date', () => {
    expect(getMarketData().lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getRate('in', 'repoRate')).toBeTypeOf('number');
    expect(getRate('zz', 'x')).toBeUndefined();
  });
});

describe('i18n messages', () => {
  it('deep merge keeps English for missing keys', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, d: 1 }, { a: { b: 9 } })).toEqual({ a: { b: 9, c: 2 }, d: 1 });
    expect(deepMerge({ a: [1] }, { a: [2] })).toEqual({ a: [2] });
  });
  it('Hindi falls back to English', async () => {
    type M = { site: { name: string }; fields: Record<string, string>; calculators: Record<string, { faq: unknown }> };
    const hi = (await loadMessages('hi-in')) as unknown as M;
    const en = (await loadMessages('en-in')) as unknown as M;
    expect(hi.site.name).not.toBe(en.site.name);
    expect(hi.fields.corpus).not.toBe(en.fields.corpus);
    expect(hi.fields.homePrice).toBe(en.fields.homePrice);
    expect(hi.calculators.swp!.faq).toEqual(en.calculators.swp!.faq);
  });
  it('client messages drop long page text', async () => {
    const m = clientMessages(await loadMessages('en-in')) as { calculators: Record<string, Record<string, unknown>> };
    expect(m.calculators.swp!.faq).toBeUndefined();
    expect(m.calculators.swp!.fields).toBeDefined();
  });
});

describe('misc helpers', () => {
  it('cn merges tailwind classes', () => {
    expect(cn('p-2', 'p-4', false && 'x')).toBe('p-4');
  });
  it('absoluteUrl and hreflang alternates', () => {
    expect(absoluteUrl('/en-in/')).toContain('/en-in/');
    const alt = languageAlternates(['en-in', 'hi-in', 'en-us'], '/about');
    expect(Object.keys(alt).sort()).toEqual(['en-IN', 'en-US', 'hi-IN', 'x-default']);
    expect(alt['x-default']).toContain('/en-in/about/');
  });
});
