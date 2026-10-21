import { absoluteUrl, parseLocale } from '@config/site';

/** hreflang map: `en-IN` -> URL for each locale, plus x-default. `path` has no locale and no trailing slash. */
export function languageAlternates(locales: string[], path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) {
    const { language, country } = parseLocale(l);
    out[`${language}-${country.code.toUpperCase()}`] = absoluteUrl(`/${l}${path}/`);
  }
  const first = locales.includes('en-in') ? 'en-in' : locales[0];
  if (first) out['x-default'] = absoluteUrl(`/${first}${path}/`);
  return out;
}
