'use client';

import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Link2, Printer, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { parseLocale } from '@config/site';
import { calculatorBySlug } from '@/calculators/registry';
import { resolveCalc } from '@/calculators/resolve';
import type { FieldDef, NumberFieldDef, Presentation, ResultCard, TableSpec, Values } from '@/calculators/types';
import { Button } from '@/components/ui/button';
import { toCsv, downloadText } from '@/lib/csv';
import { issuesToErrors } from '@/lib/errors';
import { makeFormatters, monthsToParts } from '@/lib/format';
import { fromQuery, toQuery } from '@/lib/urlState';
import { useDebounced } from '@/lib/useDebounced';
import { DataTable } from './DataTable';
import { InputSlider } from './InputSlider';
import { ModeTabs } from './ModeTabs';
import { ResultCards, type DisplayCard } from './ResultCards';

const BalanceChart = dynamic(() => import('./BalanceChart'), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-[var(--muted)]" aria-hidden="true" />,
});

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function CalculatorClient({ slug }: { slug: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const { country } = parseLocale(locale);
  const def = calculatorBySlug(slug);
  if (!def) throw new Error(`Unknown calculator: ${slug}`);
  const resolved = useMemo(() => resolveCalc(def, country), [def, country]);
  const fmt = useMemo(() => makeFormatters(locale, country), [locale, country]);

  const form = useForm<Values>({ defaultValues: resolved.defaults, mode: 'onChange' });
  const values = useWatch({ control: form.control }) as Values;
  const [ready, setReady] = useState(false);
  const [compact, setCompact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTable, setActiveTable] = useState(0);

  // After loading: restore inputs from the share link, and use today's date for date inputs.
  useEffect(() => {
    const fromUrl = fromQuery(window.location.search, resolved.defaults);
    const next: Values = { ...resolved.defaults, ...fromUrl };
    if (resolved.defaults.startDate !== undefined && fromUrl.startDate === undefined) next.startDate = todayIso();
    form.reset(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address bar can only be read in the browser, after hydration
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  const debounced = useDebounced(values, 150);
  const parsed = useMemo(() => def.schema.safeParse(debounced), [def, debounced]);
  const liveParsed = useMemo(() => def.schema.safeParse(values), [def, values]);
  const errors = useMemo(() => (liveParsed.success ? {} : issuesToErrors(liveParsed.error)), [liveParsed]);

  const modeField = def.modeField;
  const mode = modeField ? String(values[modeField] ?? resolved.defaults[modeField]) : undefined;

  const presentation: Presentation | null = useMemo(() => {
    if (!parsed.success) return null;
    const input = parsed.data as Values;
    return def.present(def.calculate(input), input);
  }, [def, parsed]);

  // Keep the address bar in sync so the page can be shared.
  // "today" is not a user choice, so it is not part of the link
  const baseline = useMemo<Values>(
    () =>
      resolved.defaults.startDate !== undefined ? { ...resolved.defaults, startDate: todayIso() } : resolved.defaults,
    [resolved],
  );

  useEffect(() => {
    if (!ready || !liveParsed.success) return;
    const q = toQuery(debounced, baseline);
    const url = `${window.location.pathname}${q ? `?${q}` : ''}`;
    window.history.replaceState(window.history.state, '', url);
  }, [ready, debounced, liveParsed.success, baseline]);

  const visible = (f: FieldDef) =>
    !f.hidden && f.name !== modeField && (!f.modes || (mode !== undefined && f.modes.includes(mode)));
  const mainFields = resolved.fields.filter((f) => visible(f) && !f.advanced);
  const advancedFields = resolved.fields.filter((f) => visible(f) && f.advanced);

  const label = useCallback(
    (name: string) => {
      const keys = [
        `calculators.${slug}.fields.${name}_${mode}`,
        `calculators.${slug}.fields.${name}`,
        `fields.${name}`,
      ];
      const key = keys.find((k) => t.has(k)) ?? keys[2]!;
      return t(key);
    },
    [t, slug, mode],
  );
  const hint = useCallback(
    (name: string) =>
      t.has(`calculators.${slug}.hints.${name}`)
        ? t(`calculators.${slug}.hints.${name}`)
        : t.has(`hints.${name}`)
          ? t(`hints.${name}`)
          : undefined,
    [t, slug],
  );

  const unitText = (f: NumberFieldDef): { prefix?: string; suffix?: string } => {
    switch (f.unit) {
      case 'currency':
        return { prefix: fmt.symbol };
      case 'percent':
        return { suffix: '%' };
      case 'years':
        return { suffix: t('units.yearsShort') };
      case 'months':
        return { suffix: t('units.monthsShort') };
      case 'age':
        return { suffix: t('units.ageShort') };
      case 'days':
        return { suffix: t('units.daysShort') };
      default:
        return {};
    }
  };

  const errorText = (name: string): string | undefined => {
    const e = errors[name];
    if (!e) return undefined;
    const params: Record<string, string | number> = {};
    const field = resolved.fields.find((f) => f.name === name);
    const asCurrency = field?.kind === 'number' && field.unit === 'currency';
    for (const [k, v] of Object.entries(e.params ?? {})) {
      params[k] = typeof v === 'number' ? (asCurrency ? fmt.currency(v) : fmt.number(v)) : v;
    }
    return t.has(`errors.${e.key}`) ? t(`errors.${e.key}`, params) : t('errors.invalid');
  };

  const setValue = (name: string, value: number | string) =>
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true });

  const formatDuration = (months: number): string => {
    if (!Number.isFinite(months)) return t('values.neverUsedUp');
    const { years, months: m } = monthsToParts(months);
    const parts: string[] = [];
    if (years > 0) parts.push(t('units.years', { count: years }));
    if (m > 0 || years === 0) parts.push(t('units.months', { count: m }));
    return parts.join(' ');
  };

  const formatValue = (v: number | string, kind: ResultCard['kind']): string => {
    if (typeof v === 'string') return v;
    switch (kind) {
      case 'currency':
        return fmt.currency(v, { compact });
      case 'percent':
        return fmt.percent(v);
      case 'duration':
        return formatDuration(v);
      case 'years':
        return t('units.years', { count: v });
      case 'days':
        return t('units.days', { count: Math.round(v) });
      case 'age':
        return t('units.age', { count: v });
      default:
        return fmt.number(v);
    }
  };

  const warningText = (w: { code: string; params?: Record<string, number | string> }): string => {
    const params: Record<string, string | number> = { ...(w.params ?? {}) };
    if (typeof params.limit === 'number') params.limit = fmt.currency(params.limit);
    return t.has(`warnings.${w.code}`) ? t(`warnings.${w.code}`, params) : w.code;
  };

  const cards: DisplayCard[] = (presentation?.cards ?? []).map((c) => ({
    id: c.id,
    label: t(`labels.${c.id}`),
    value: formatValue(c.value, c.kind),
    tone: c.tone,
  }));

  const tables = presentation?.tables ?? [];
  const table: TableSpec | undefined = tables[Math.min(activeTable, Math.max(0, tables.length - 1))];
  const headers = useMemo(() => {
    const out: Record<string, string> = {};
    for (const tb of tables) for (const c of tb.columns) out[c.labelKey] = t(`labels.${c.labelKey}`);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation, t]);

  const chartLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of presentation?.chart?.series ?? []) out[s.key] = t(`labels.${s.labelKey}`);
    return out;
  }, [presentation, t]);

  const share = async () => {
    const q = toQuery(values, baseline);
    const url = `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t('actions.copyPrompt'), url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadCsv = () => {
    if (!table) return;
    const head = table.columns.map((c) => t(`labels.${c.labelKey}`));
    const rows = table.rows.map((r) => table.columns.map((c) => r[c.key] ?? ''));
    downloadText(`${slug}-${table.id}.csv`, toCsv(head, rows));
  };

  const reset = () => {
    const next: Values = { ...resolved.defaults };
    if (next.startDate !== undefined) next.startDate = todayIso();
    form.reset(next);
    setActiveTable(0);
  };

  const renderField = (f: FieldDef) => {
    const name = f.name;
    const current = values[name];
    if (f.kind === 'number') {
      const u = unitText(f);
      return (
        <InputSlider
          key={name}
          label={label(name)}
          value={typeof current === 'number' ? current : NaN}
          onChange={(v) => setValue(name, v)}
          min={f.min}
          max={f.max}
          step={f.step}
          prefix={u.prefix}
          suffix={u.suffix}
          error={errorText(name)}
          hint={hint(name)}
        />
      );
    }
    const id = `field-${name}`;
    const err = errorText(name);
    return (
      <div key={name} className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium">
          {label(name)}
        </label>
        {f.kind === 'select' ? (
          <select
            id={id}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3"
            value={String(current ?? '')}
            onChange={(e) => setValue(name, e.target.value)}
          >
            {f.options.map((o) => (
              <option key={o} value={o}>
                {t(`options.${name}.${o}`)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type="date"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3"
            value={String(current ?? '')}
            aria-invalid={err ? true : undefined}
            onChange={(e) => setValue(name, e.target.value)}
          />
        )}
        {hint(name) ? <p className="text-xs text-[var(--fg-muted)]">{hint(name)}</p> : null}
        {err ? (
          <p role="alert" className="text-xs font-medium text-[var(--danger)]">
            {err}
          </p>
        ) : null}
      </div>
    );
  };

  const modeFieldDef = modeField ? resolved.fields.find((f) => f.name === modeField) : undefined;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="space-y-6">
      {modeFieldDef && modeFieldDef.kind === 'select' ? (
        <ModeTabs
          label={label(modeFieldDef.name)}
          options={modeFieldDef.options.map((o) => ({ value: o, label: t(`options.${modeFieldDef.name}.${o}`) }))}
          value={mode ?? ''}
          onChange={(v) => setValue(modeFieldDef.name, v)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="inputs-heading"
          className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <h2 id="inputs-heading" className="text-lg font-semibold">
            {t('calculator.inputs')}
          </h2>
          <div className="space-y-5">{mainFields.map(renderField)}</div>
          {advancedFields.length > 0 ? (
            <details className="rounded-lg border border-[var(--border)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">{t('calculator.advanced')}</summary>
              <div className="mt-4 space-y-5">{advancedFields.map(renderField)}</div>
            </details>
          ) : null}
          <div className="no-print flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <Button size="sm" onClick={share}>
              <Link2 className="size-4" aria-hidden="true" />
              {copied ? t('actions.copied') : t('actions.share')}
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              {t('actions.print')}
            </Button>
            <Button size="sm" onClick={downloadCsv} disabled={!table}>
              <Download className="size-4" aria-hidden="true" />
              {t('actions.csv')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('actions.reset')}
            </Button>
          </div>
        </section>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="results-heading" className="text-lg font-semibold">
              {t('calculator.results')}
            </h2>
            <label className="no-print flex items-center gap-2 text-sm">
              <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              {t('calculator.shortNumbers')}
            </label>
          </div>

          {hasErrors ? (
            <p role="status" className="rounded-lg border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">
              {t('calculator.fixErrors')}
            </p>
          ) : null}

          {presentation && !hasErrors ? (
            <>
              {presentation.warnings.length > 0 ? (
                <ul className="space-y-2" aria-label={t('calculator.warnings')}>
                  {presentation.warnings.map((w, i) => (
                    <li
                      key={`${w.code}-${i}`}
                      className="rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] p-3 text-sm font-medium text-[var(--warn)]"
                    >
                      {warningText(w)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ResultCards cards={cards} />
              {presentation.chart ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <BalanceChart
                    spec={presentation.chart}
                    labels={chartLabels}
                    xLabel={t(`labels.${presentation.chart.xLabelKey}`)}
                    formatValue={(n) => fmt.currency(n, { compact })}
                    formatAxis={(n) => fmt.currency(n, { compact: true })}
                    ariaLabel={t('calculator.chartLabel')}
                  />
                </div>
              ) : null}
              {table ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{t(table.labelKey)}</h3>
                    {tables.length > 1 ? (
                      <div
                        className="no-print flex flex-wrap gap-1"
                        role="group"
                        aria-label={t('calculator.tableView')}
                      >
                        {tables.map((tb, i) => (
                          <Button
                            key={tb.id}
                            size="sm"
                            variant={tb === table ? 'primary' : 'outline'}
                            aria-pressed={tb === table}
                            onClick={() => setActiveTable(i)}
                          >
                            {t(tb.labelKey)}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <DataTable
                    spec={table}
                    caption={t(table.labelKey)}
                    headers={headers}
                    formatCell={(v, kind) => (kind === 'number' ? String(v) : formatValue(v, kind))}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <p className="text-sm text-[var(--fg-muted)]">{t('disclaimer.short')}</p>
        </section>
      </div>
    </div>
  );
}
