'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface DisplayCard {
  id: string;
  label: string;
  /** final text, always correct (used for screen readers and when motion is off) */
  value: string;
  /** when set, the number counts up or down to this value whenever it changes */
  raw?: number;
  format?: (n: number) => string;
  tone?: 'primary' | 'good' | 'warn' | 'neutral';
}

const DURATION_MS = 550;

/** Counts from the previous number to the new one. Starts at the final value, so the first paint is already correct. */
function AnimatedNumber({ raw, format, text }: { raw: number; format: (n: number) => string; text: string }) {
  const [shown, setShown] = useState(raw);
  const from = useRef(raw);
  const frame = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === raw || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      from.current = raw;
      frame.current = requestAnimationFrame(() => setShown(raw));
      return () => cancelAnimationFrame(frame.current);
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (raw - start) * eased;
      from.current = v;
      setShown(v);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = raw;
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [raw]);

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/** Summary numbers. The wrapper announces changes to screen readers. */
export function ResultCards({ cards }: { cards: DisplayCard[] }) {
  return (
    <div aria-live="polite" aria-atomic="false" className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, idx) => (
        <div
          key={c.id}
          data-testid={`card-${c.id}`}
          style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
          className={cn(
            'fade-up rounded-xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
            idx === 0 ? 'sm:col-span-2' : '',
            c.tone === 'primary' &&
              'border-transparent bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface)]',
            c.tone === 'warn' && 'border-[var(--warn)] bg-[var(--warn-soft)]',
            (!c.tone || c.tone === 'neutral' || c.tone === 'good') && 'border-[var(--border)] bg-[var(--surface)]',
          )}
        >
          <p className="text-sm text-[var(--fg-muted)]">{c.label}</p>
          <p
            className={cn(
              'mt-1 font-bold break-words tabular-nums',
              idx === 0 ? 'text-3xl' : 'text-xl',
              c.tone === 'good' && 'text-[var(--good)]',
              c.tone === 'warn' && 'text-[var(--warn)]',
            )}
          >
            {c.raw !== undefined && c.format && Number.isFinite(c.raw) ? (
              <AnimatedNumber raw={c.raw} format={c.format} text={c.value} />
            ) : (
              c.value
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
