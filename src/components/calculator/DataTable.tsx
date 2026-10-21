'use client';

import type { TableSpec } from '@/calculators/types';

export interface DataTableProps {
  spec: TableSpec;
  caption: string;
  headers: Record<string, string>;
  formatCell: (value: number | string, kind: TableSpec['columns'][number]['kind']) => string;
}

/** Scrollable table with a sticky header. */
export function DataTable({ spec, caption, headers, formatCell }: DataTableProps) {
  return (
    <div
      className="print-expand max-h-96 overflow-auto rounded-lg border border-[var(--border)]"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-[var(--muted)]">
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 text-end font-semibold first:text-start">
                {headers[c.labelKey] ?? c.labelKey}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, idx) => (
            <tr key={idx} className="border-t border-[var(--border)] odd:bg-[var(--surface)]">
              {spec.columns.map((c) => (
                <td key={c.key} className="px-3 py-1.5 text-end tabular-nums first:text-start">
                  {formatCell(row[c.key] ?? '', c.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
