// ============================================
// AdLab Table
// ============================================
// Minimal, reusable table component for AdLab.
// Matches existing PostsTable styling.

import React from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface AdLabTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic table accepts any object shape
export function AdLabTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data available',
}: AdLabTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-secondary/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={`px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item) => (
              <tr
                key={String(item[keyField])}
                className="hover:bg-secondary/40 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3.5 text-sm text-foreground ${col.className || ''}`}
                  >
                    {col.render
                      ? col.render(item)
                      : String(item[col.key as keyof T] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdLabTable;
