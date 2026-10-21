import type { Values } from '@/calculators/types';

/** Write the inputs into a query string. Only values that differ from the defaults are kept. */
export function toQuery(values: Values, defaults: Values): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v === defaults[k]) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    params.set(k, String(v));
  }
  return params.toString();
}

/** Read inputs from a query string. Only keys that exist in `defaults` are accepted, with the same type. */
export function fromQuery(search: string, defaults: Values): Values {
  const params = new URLSearchParams(search);
  const out: Values = {};
  for (const [k, def] of Object.entries(defaults)) {
    const raw = params.get(k);
    if (raw === null) continue;
    if (typeof def === 'number') {
      const n = Number(raw);
      if (raw.trim() !== '' && Number.isFinite(n)) out[k] = n;
    } else {
      out[k] = raw;
    }
  }
  return out;
}
