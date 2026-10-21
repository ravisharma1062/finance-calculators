import { cn } from '@/lib/utils';

export interface DisplayCard {
  id: string;
  label: string;
  value: string;
  tone?: 'primary' | 'good' | 'warn' | 'neutral';
}

/** Summary numbers. The wrapper announces changes to screen readers. */
export function ResultCards({ cards }: { cards: DisplayCard[] }) {
  return (
    <div aria-live="polite" aria-atomic="false" className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, idx) => (
        <div
          key={c.id}
          data-testid={`card-${c.id}`}
          className={cn(
            'rounded-xl border p-4',
            idx === 0 ? 'sm:col-span-2' : '',
            c.tone === 'primary' && 'border-transparent bg-[var(--accent-soft)]',
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
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
