import type { CountryConfig } from '@config/site';

export interface Formatters {
  symbol: string;
  currency: (n: number, opts?: { compact?: boolean; decimals?: number }) => string;
  number: (n: number, maxDecimals?: number) => string;
  percent: (n: number) => string;
}

function indianCompact(n: number, symbol: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
  if (abs >= 1e7) return `${sign}${symbol}${fmt(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}${symbol}${fmt(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}${symbol}${fmt(abs / 1e3)} K`;
  return `${sign}${symbol}${fmt(abs)}`;
}

/**
 * Number helpers for a locale. India uses lakh/crore grouping (en-IN). Other countries use millions/billions.
 */
export function makeFormatters(locale: string, country: CountryConfig): Formatters {
  const tag = locale.replace(
    /^([a-z]{2})-([a-z]{2})$/i,
    (_m, l: string, c: string) => `${l.toLowerCase()}-${c.toUpperCase()}`,
  );
  const cur = (decimals: number) =>
    new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: country.currency,
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    });
  const symbol = (cur(0)
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? '') as string;
  const compactIntl = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: country.currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return {
    symbol,
    currency: (n, opts = {}) => {
      if (!Number.isFinite(n)) return '-';
      if (opts.compact) return country.numberSystem === 'indian' ? indianCompact(n, symbol) : compactIntl.format(n);
      return cur(opts.decimals ?? 0).format(
        Math.round(n * Math.pow(10, opts.decimals ?? 0)) / Math.pow(10, opts.decimals ?? 0),
      );
    },
    number: (n, maxDecimals = 2) =>
      Number.isFinite(n) ? new Intl.NumberFormat(tag, { maximumFractionDigits: maxDecimals }).format(n) : '-',
    percent: (n) =>
      Number.isFinite(n) ? `${new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(n)}%` : '-',
  };
}

/** Split a month count into whole years and months. */
export function monthsToParts(totalMonths: number): { years: number; months: number } {
  const whole = Math.floor(totalMonths + 1e-9);
  return { years: Math.floor(whole / 12), months: whole % 12 };
}
