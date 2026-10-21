import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { absoluteUrl, parseLocale, siteConfig } from '@config/site';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Analytics } from '@/components/seo/Analytics';
import { clientMessages } from '@/i18n/messages';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: `${t('name')}: ${t('tagline')}`, template: `%s | ${t('name')}` },
    description: t('description'),
    applicationName: siteConfig.name,
  };
}

// Sets the dark class before the page paints, so there is no flash.
const themeScript = `try{var s=localStorage.getItem('fincalc:theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('nav');
  const { language, country } = parseLocale(locale);

  return (
    <html lang={`${language}-${country.code.toUpperCase()}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider locale={locale} messages={clientMessages(messages as Record<string, unknown>) as never}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--surface)] focus:p-2"
          >
            {t('skip')}
          </a>
          <Header />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
