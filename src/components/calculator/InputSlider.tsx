'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface InputSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  error?: string;
  hint?: string;
  /** hide the range slider (for wide-range numbers) */
  noSlider?: boolean;
}

const toText = (v: number) => (Number.isFinite(v) ? String(v) : '');

/** A typed number field and a slider that always show the same value. */
export function InputSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  error,
  hint,
  noSlider,
}: InputSliderProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [text, setText] = useState(toText(value));

  // Follow the value when it changes from outside (the slider, reset, a share link),
  // but leave half-typed text such as "7." alone while it still means the same number.
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    const parsed = text.trim() === '' ? NaN : Number(text);
    if (!Object.is(parsed, value)) setText(toText(value));
  }

  const sliderValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-1 rounded-lg border bg-[var(--surface)] px-3 focus-within:outline-2 focus-within:outline-[var(--accent)]',
          error ? 'border-[var(--danger)]' : 'border-[var(--border)]',
        )}
      >
        {prefix ? <span className="text-sm text-[var(--fg-muted)]">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="h-10 w-full min-w-0 bg-transparent text-base font-semibold outline-none"
          value={text}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value.trim() === '' ? NaN : Number(e.target.value));
          }}
        />
        {suffix ? <span className="shrink-0 text-sm text-[var(--fg-muted)]">{suffix}</span> : null}
      </div>
      {noSlider ? null : (
        <input
          type="range"
          aria-label={label}
          className="block h-6 w-full cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--fg-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
