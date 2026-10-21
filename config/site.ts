import gb from './countries/gb.json';
import inCountry from './countries/in.json';
import us from './countries/us.json';

export interface TaxRule {
  lastUpdated: string;
  sourceUrl: string;
  [key: string]: number | string;
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  locale: string;
  numberSystem: 'indian' | 'international';
  languages: string[];
  amountScale: number;
  defaultReturn: number;
  defaultInflation: number;
  calculators: string[];
  overrides: Record<string, Record<string, number | string>>;
  taxRules: Record<string, TaxRule>;
}

/** Adding a country = one new JSON file here, plus a messages entry for its name. */
export const countries: Record<string, CountryConfig> = {
  in: inCountry as CountryConfig,
  us: us as CountryConfig,
  gb: gb as CountryConfig,
};

export const countryCodes = Object.keys(countries);

/** The URL locale is `<language>-<country>`, for example `en-in` or `hi-in`. */
export const locales = countryCodes.flatMap((c) => countries[c]!.languages.map((l) => `${l}-${c}`));
export const defaultLocale = 'en-in';

export const siteConfig = {
  name: 'Finance Calculators',
  repoName: 'finance-calculators',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ravisharma1062.github.io',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  analyticsDomain: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? '',
  githubUrl: 'https://github.com/ravisharma1062/finance-calculators',
  contactEmail: 'ravisharma.1062@gmail.com',
};

export function parseLocale(locale: string): { language: string; country: CountryConfig } {
  const [language = 'en', code = 'in'] = locale.split('-');
  return { language, country: countries[code] ?? countries.in! };
}

export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${siteConfig.url}${siteConfig.basePath}${clean}`;
}
