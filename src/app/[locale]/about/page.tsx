import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { absoluteUrl, locales } from '@config/site';
import { languageAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return {
    title: t('aboutTitle'),
    alternates: { canonical: absoluteUrl(`/${locale}/about/`), languages: languageAlternates(locales, '/about') },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages');
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">{t('aboutTitle')}</h1>
      <p>{t('aboutP1')}</p>
      <p>{t('aboutP2')}</p>
      <p>{t('aboutP3')}</p>
    </div>
  );
}
