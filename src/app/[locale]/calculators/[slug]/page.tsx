import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { absoluteUrl, locales, parseLocale } from '@config/site';
import { calculatorBySlug } from '@/calculators/registry';
import { resolveCalc } from '@/calculators/resolve';
import { CalculatorClient } from '@/components/calculator/CalculatorClient';
import { CalcIcon } from '@/components/icons';
import { JsonLd } from '@/components/seo/JsonLd';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { languageAlternates } from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => parseLocale(locale).country.calculators.map((slug) => ({ locale, slug })));
}

interface Params {
  locale: string;
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const { country } = parseLocale(locale);
  const t = await getTranslations({ locale });
  const available = locales.filter((l) => parseLocale(l).country.calculators.includes(slug));
  const title = `${t(`calculators.${slug}.metaTitle`)} (${t(`countries.${country.code}`)})`;
  const description = t(`calculators.${slug}.metaDescription`);
  const url = absoluteUrl(`/${locale}/calculators/${slug}/`);
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(available, `/calculators/${slug}`) },
    openGraph: { title, description, url, type: 'website', siteName: t('site.name') },
    twitter: { card: 'summary', title, description },
  };
}

interface Faq {
  q: string;
  a: string;
}

export default async function CalculatorPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const def = calculatorBySlug(slug);
  const { country } = parseLocale(locale);
  if (!def || !country.calculators.includes(slug)) notFound();

  const t = await getTranslations();
  const base = `calculators.${slug}`;
  const faq = t.raw(`${base}.faq`) as Faq[];
  const name = t(`${base}.name`);
  const url = absoluteUrl(`/${locale}/calculators/${slug}/`);
  const rules = country.taxRules[slug];
  const resolved = resolveCalc(def, country);
  const related = def.related.filter((s) => country.calculators.includes(s));

  return (
    <article className="space-y-10">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name,
          description: t(`${base}.metaDescription`),
          url,
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Any',
          inLanguage: locale,
          offers: { '@type': 'Offer', price: '0', priceCurrency: country.currency },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t('nav.home'), item: absoluteUrl(`/${locale}/`) },
            { '@type': 'ListItem', position: 2, name, item: url },
          ],
        }}
      />

      <header className="space-y-3">
        <nav aria-label={t('nav.breadcrumb')} className="no-print text-sm text-[var(--fg-muted)]">
          <Link href="/">{t('nav.home')}</Link> <span aria-hidden="true">/</span> <span>{name}</span>
        </nav>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <CalcIcon name={def.icon} className="size-8 text-[var(--accent)]" />
          {name}
        </h1>
        <p className="max-w-3xl text-[var(--fg-muted)]">{t(`${base}.intro`)}</p>
      </header>

      <CalculatorClient slug={slug} />

      <section aria-labelledby="how" className="max-w-3xl space-y-3">
        <h2 id="how" className="text-2xl font-semibold">
          {t('calculator.howItWorks')}
        </h2>
        <p>{t(`${base}.howItWorks`)}</p>
        <h3 className="font-semibold">{t('calculator.formula')}</h3>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm whitespace-pre-wrap">
          {t(`${base}.formula`)}
        </pre>
        {rules ? (
          <ul className="list-disc space-y-1 ps-5 text-sm text-[var(--fg-muted)]">
            {Object.entries(rules)
              .filter(([k]) => k !== 'lastUpdated' && k !== 'sourceUrl')
              .map(([k, v]) => (
                <li key={k}>
                  {t.has(`fields.${k}`) ? t(`fields.${k}`) : k}: {String(v)}
                </li>
              ))}
            <li>
              {rules.lastUpdated} ·{' '}
              <a href={rules.sourceUrl} rel="noopener noreferrer">
                {rules.sourceUrl}
              </a>
            </li>
          </ul>
        ) : null}
        <p className="text-sm text-[var(--fg-muted)]">
          {resolved.country.currency} · {t('disclaimer.short')}
        </p>
      </section>

      <section aria-labelledby="faq" className="max-w-3xl space-y-3">
        <h2 id="faq" className="text-2xl font-semibold">
          {t('calculator.faq')}
        </h2>
        <div className="space-y-2">
          {faq.map((f) => (
            <details key={f.q} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-[var(--fg-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="no-print space-y-3">
          <h2 id="related" className="text-2xl font-semibold">
            {t('calculator.related')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((s) => (
              <li key={s}>
                <Link
                  href={`/calculators/${s}`}
                  className="block h-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-medium no-underline hover:shadow"
                >
                  {t(`calculators.${s}.name`)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="max-w-3xl rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
        <strong>{t('disclaimer.title')}.</strong> {t('disclaimer.p1')}
      </section>
    </article>
  );
}
