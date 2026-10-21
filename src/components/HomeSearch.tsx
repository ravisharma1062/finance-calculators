'use client';

import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { CalcIcon } from '@/components/icons';
import { Link } from '@/i18n/navigation';

export interface HomeItem {
  slug: string;
  name: string;
  short: string;
  icon: string;
  category: string;
}

export interface HomeSearchProps {
  items: HomeItem[];
  categories: { id: string; title: string }[];
  labels: { search: string; placeholder: string; none: string };
}

export function HomeSearch({ items, categories, labels }: HomeSearchProps) {
  const [query, setQuery] = useState('');
  const id = useId();
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((i) => `${i.name} ${i.short} ${i.slug}`.toLowerCase().includes(q)) : items),
    [items, q],
  );

  return (
    <div className="space-y-8">
      <div className="relative mx-auto max-w-xl">
        <label htmlFor={id} className="sr-only">
          {labels.search}
        </label>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-[var(--fg-muted)]"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.placeholder}
          className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] ps-11 pe-4 text-base"
        />
      </div>
      <div aria-live="polite">
        {filtered.length === 0 ? <p className="text-center text-[var(--fg-muted)]">{labels.none}</p> : null}
      </div>
      {categories.map((cat) => {
        const list = filtered.filter((i) => i.category === cat.id);
        if (list.length === 0) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <h2 id={`cat-${cat.id}`} className="mb-3 text-xl font-semibold">
              {cat.title}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/calculators/${i.slug}`}
                    className="flex h-full gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 no-underline transition-shadow hover:shadow-md"
                    style={{ color: 'var(--fg)' }}
                  >
                    <CalcIcon name={i.icon} className="mt-1 size-6 shrink-0 text-[var(--accent)]" />
                    <span>
                      <span className="block font-semibold">{i.name}</span>
                      <span className="block text-sm text-[var(--fg-muted)]">{i.short}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
