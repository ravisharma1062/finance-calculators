'use client';

import { useEffect } from 'react';
import { pickLocale } from '@/lib/detectLocale';

/** The site root has no language. Send the visitor to the best match, or to the language they chose before. */
export function RedirectToLocale({ basePath }: { basePath: string }) {
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('fincalc:locale');
    } catch {
      // ignore
    }
    const locale = pickLocale(navigator.languages?.length ? navigator.languages : [navigator.language], saved);
    window.location.replace(`${basePath}/${locale}/${window.location.search}`);
  }, [basePath]);
  return null;
}
