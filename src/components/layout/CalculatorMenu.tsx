'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

export interface MenuGroup {
  category: string;
  title: string;
  items: { slug: string; name: string }[];
}

export function CalculatorMenu({ label, groups }: { label: string; groups: MenuGroup[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details ref={ref} className="no-print relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--muted)]">
        {label}
        <ChevronDown className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute start-0 z-30 mt-2 grid max-h-[70vh] w-[min(92vw,34rem)] gap-4 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.category}>
            <p className="mb-1 text-xs font-semibold tracking-wide text-[var(--fg-muted)] uppercase">{g.title}</p>
            <ul className="space-y-1">
              {g.items.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/calculators/${i.slug}`}
                    className="block rounded px-2 py-1 text-sm no-underline hover:bg-[var(--muted)]"
                    style={{ color: 'var(--fg)' }}
                  >
                    {i.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
