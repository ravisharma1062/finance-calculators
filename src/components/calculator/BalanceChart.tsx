'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartSpec } from '@/calculators/types';

export interface BalanceChartProps {
  spec: ChartSpec;
  labels: Record<string, string>;
  xLabel: string;
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  ariaLabel: string;
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

export default function BalanceChart({ spec, labels, xLabel, formatValue, formatAxis, ariaLabel }: BalanceChartProps) {
  const animate = typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  return (
    <div role="img" aria-label={ariaLabel} className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={spec.rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={spec.xKey}
            tick={{ fill: 'var(--fg-muted)', fontSize: 12 }}
            stroke="var(--border)"
            label={{ value: xLabel, position: 'insideBottom', offset: -2, fill: 'var(--fg-muted)', fontSize: 12 }}
            height={36}
          />
          <YAxis
            width={64}
            tickFormatter={formatAxis}
            tick={{ fill: 'var(--fg-muted)', fontSize: 12 }}
            stroke="var(--border)"
          />
          <Tooltip
            formatter={(v) => formatValue(Number(v))}
            labelFormatter={(l) => `${xLabel}: ${l}`}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--fg)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {spec.series.map((s, i) => {
            const color = COLORS[i % COLORS.length]!;
            const name = labels[s.key] ?? s.key;
            if (s.type === 'bar')
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={name}
                  stackId={s.stack}
                  fill={color}
                  isAnimationActive={animate}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              );
            if (s.type === 'line')
              return (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  type="monotone"
                  isAnimationActive={animate}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              );
            return (
              <Area
                key={s.key}
                dataKey={s.key}
                name={name}
                stroke={color}
                fill={color}
                fillOpacity={0.18}
                strokeWidth={2}
                type="monotone"
                isAnimationActive={animate}
                animationDuration={800}
                animationEasing="ease-out"
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
