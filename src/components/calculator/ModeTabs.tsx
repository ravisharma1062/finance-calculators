'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface ModeTabsProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

/** Tabs that pick the calculator mode. Arrow keys move between tabs. */
export function ModeTabs({ label, options, value, onChange }: ModeTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, dir: 1 | -1) => {
    const next = (from + dir + options.length) % options.length;
    const opt = options[next];
    if (!opt) return;
    onChange(opt.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="no-print flex flex-wrap gap-2">
      {options.map((o, idx) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(idx, 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(idx, -1);
              }
            }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--muted)]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
