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
              {list.map((i, n) => (
                <li key={i.slug} className="fade-up" style={{ animationDelay: `${Math.min(n, 8) * 50}ms` }}>
                  <Link
                    href={`/calculators/${i.slug}`}
                    className="group flex h-full gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 no-underline shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-lg"
                    style={{ color: 'var(--fg)' }}
                  >
                    <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
                      <CalcIcon name={i.icon} className="size-5" />
                    </span>
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
