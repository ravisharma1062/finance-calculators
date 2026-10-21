import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { absoluteUrl, locales, parseLocale } from '@config/site';
import { calculatorsForCountry } from '@/calculators/resolve';
import { CATEGORIES } from '@/calculators/types';
import { HomeSearch } from '@/components/HomeSearch';
import { JsonLd } from '@/components/seo/JsonLd';
import { languageAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const s = await getTranslations({ locale, namespace: 'site' });
  return {
    title: { absolute: `${s('name')}: ${s('tagline')}` },
    description: s('description'),
    alternates: { canonical: absoluteUrl(`/${locale}/`), languages: languageAlternates(locales, '') },
    openGraph: { title: t('title'), description: s('description'), url: absoluteUrl(`/${locale}/`), type: 'website' },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const { country } = parseLocale(locale);
  const items = calculatorsForCountry(country).map((c) => ({
    slug: c.slug,
    name: t(`calculators.${c.slug}.name`),
    short: t(`calculators.${c.slug}.short`),
    icon: c.icon,
    category: c.category,
  }));

  return (
    <div className="space-y-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: t('site.name'),
          url: absoluteUrl(`/${locale}/`),
          inLanguage: locale,
        }}
      />
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('home.title')}</h1>
        <p className="mt-3 text-lg text-[var(--fg-muted)]">{t('home.subtitle')}</p>
      </section>
      <HomeSearch
        items={items}
        categories={CATEGORIES.map((id) => ({ id, title: t(`categories.${id}`) }))}
        labels={{ search: t('home.searchLabel'), placeholder: t('home.searchPlaceholder'), none: t('home.noResults') }}
      />
      <section aria-labelledby="why" className="grid gap-4 sm:grid-cols-3">
        <h2 id="why" className="sr-only">
          {t('home.whyTitle')}
        </h2>
        {[1, 2, 3].map((n) => (
          <div key={n} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-semibold">{t(`home.why${n}Title`)}</h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{t(`home.why${n}Text`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
