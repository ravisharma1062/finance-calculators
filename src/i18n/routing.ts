import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@config/site';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
