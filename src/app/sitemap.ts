import type { MetadataRoute } from 'next';
import { absoluteUrl, countries, locales, parseLocale } from '@config/site';

export const dynamic = 'force-static';

const STATIC_PAGES = ['', '/about', '/privacy', '/disclaimer'];

export default function sitemap(): MetadataRoute.Sitemap {
  const urlFor = (locale: string, path: string) => absoluteUrl(`/${locale}${path}/`);
  const hreflang = (locale: string) => {
    const { language, country } = parseLocale(locale);
    return `${language}-${country.code.toUpperCase()}`;
  };
  const entries: MetadataRoute.Sitemap = [];
  for (const path of STATIC_PAGES) {
    for (const locale of locales) {
      entries.push({
        url: urlFor(locale, path),
        changeFrequency: path === '' ? 'weekly' : 'yearly',
        priority: path === '' ? 1 : 0.3,
        alternates: { languages: Object.fromEntries(locales.map((l) => [hreflang(l), urlFor(l, path)])) },
      });
    }
  }
  const slugs = [...new Set(Object.values(countries).flatMap((c) => c.calculators))];
  for (const slug of slugs) {
    const available = locales.filter((l) => parseLocale(l).country.calculators.includes(slug));
    for (const locale of available) {
      entries.push({
        url: urlFor(locale, `/calculators/${slug}`),
        changeFrequency: 'monthly',
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(available.map((l) => [hreflang(l), urlFor(l, `/calculators/${slug}`)])),
        },
      });
    }
  }
  return entries;
}
