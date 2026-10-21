import { Calculator } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { parseLocale } from '@config/site';
import { calculatorsForCountry } from '@/calculators/resolve';
import { CATEGORIES } from '@/calculators/types';
import { Link } from '@/i18n/navigation';
import { CalculatorMenu, type MenuGroup } from './CalculatorMenu';
import { CountrySwitcher, LanguageSwitcher, ThemeToggle } from './Switchers';

export async function Header() {
  const locale = await getLocale();
  const t = await getTranslations();
  const { country } = parseLocale(locale);
  const calcs = calculatorsForCountry(country);
  const groups: MenuGroup[] = CATEGORIES.map((category) => ({
    category,
    title: t(`categories.${category}`),
    items: calcs
      .filter((c) => c.category === category)
      .map((c) => ({ slug: c.slug, name: t(`calculators.${c.slug}.name`) })),
  })).filter((g) => g.items.length > 0);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold no-underline"
          style={{ color: 'var(--fg)' }}
        >
          <Calculator className="size-6 text-[var(--accent)]" aria-hidden="true" />
          {t('site.name')}
        </Link>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <CalculatorMenu label={t('nav.calculators')} groups={groups} />
          <CountrySwitcher />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
