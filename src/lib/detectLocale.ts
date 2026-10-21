import { defaultLocale, locales } from '@config/site';

/** Pick a site locale from the browser languages. A saved choice always wins. */
export function pickLocale(languages: readonly string[], saved?: string | null): string {
  if (saved && locales.includes(saved)) return saved;
  for (const raw of languages) {
    const [lang = '', region = ''] = raw.toLowerCase().split('-');
    const exact = `${lang}-${region}`;
    if (locales.includes(exact)) return exact;
    if (lang === 'hi') return 'hi-in';
    if (lang === 'en') {
      if (region === 'us' || region === 'ca') return 'en-us';
      if (['gb', 'au', 'nz', 'ie', 'za'].includes(region)) return 'en-gb';
      return 'en-in';
    }
  }
  return defaultLocale;
}
