import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { absoluteUrl, locales } from '@config/site';
import { languageAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'disclaimer' });
  return {
    title: t('title'),
    alternates: {
      canonical: absoluteUrl(`/${locale}/disclaimer/`),
      languages: languageAlternates(locales, '/disclaimer'),
    },
  };
}

export default async function DisclaimerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('disclaimer');
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p>{t('p1')}</p>
      <p>{t('p2')}</p>
      <p>{t('p3')}</p>
    </div>
  );
}
