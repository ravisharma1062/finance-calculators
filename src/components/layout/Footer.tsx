import { getTranslations } from 'next-intl/server';
import { siteConfig } from '@config/site';
import { Link } from '@/i18n/navigation';

export async function Footer() {
  const t = await getTranslations('footer');
  const linkClass = 'no-underline hover:underline';
  return (
    <footer className="no-print mt-12 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-[var(--fg-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights')}</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/about" className={linkClass}>
            {t('about')}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {t('privacy')}
          </Link>
          <Link href="/disclaimer" className={linkClass}>
            {t('disclaimer')}
          </Link>
          <a href={siteConfig.issuesUrl} className={linkClass} rel="noopener noreferrer">
            {t('contact')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
