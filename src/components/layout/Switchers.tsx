'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { countries, countryCodes, parseLocale } from '@config/site';
import { usePathname, useRouter } from '@/i18n/navigation';

function remember(locale: string) {
  try {
    localStorage.setItem('fincalc:locale', locale);
  } catch {
    // ignore: remembering the choice is optional
  }
}

const selectClass = 'h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm';

export function CountrySwitcher() {
  const t = useTranslations('nav');
  const tc = useTranslations('countries');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { language, country } = parseLocale(locale);

  const change = (code: string) => {
    const target = countries[code]!;
    const lang = target.languages.includes(language) ? language : 'en';
    const next = `${lang}-${code}`;
    // go home if the calculator is not offered in the new country
    const m = pathname.match(/^\/calculators\/([^/]+)/);
    const path = m && !target.calculators.includes(m[1]!) ? '/' : pathname;
    remember(next);
    router.replace(path, { locale: next });
  };

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t('country')}</span>
      <select
        className={selectClass}
        value={country.code}
        onChange={(e) => change(e.target.value)}
        aria-label={t('country')}
      >
        {countryCodes.map((c) => (
          <option key={c} value={c}>
            {tc(c)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const tl = useTranslations('languages');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { language, country } = parseLocale(locale);
  if (country.languages.length < 2) return null;

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t('language')}</span>
      <select
        className={selectClass}
        value={language}
        aria-label={t('language')}
        onChange={(e) => {
          const next = `${e.target.value}-${country.code}`;
          remember(next);
          router.replace(pathname, { locale: next });
        }}
      >
        {country.languages.map((l) => (
          <option key={l} value={l}>
            {tl(l)}
          </option>
        ))}
      </select>
    </label>
  );
}

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const t = useTranslations('nav');
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fincalc:theme');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable in the browser, after hydration
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    } catch {
      // ignore
    }
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    try {
      if (next === 'system') localStorage.removeItem('fincalc:theme');
      else localStorage.setItem('fincalc:theme', next);
    } catch {
      // ignore
    }
    const dark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  };

  const order: Theme[] = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(theme) + 1) % order.length]!;
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : SunMoon;
  const names: Record<Theme, string> = { light: t('themeLight'), dark: t('themeDark'), system: t('themeSystem') };

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]"
      aria-label={`${t('theme')}: ${names[theme]}`}
      title={`${t('theme')}: ${names[theme]}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
