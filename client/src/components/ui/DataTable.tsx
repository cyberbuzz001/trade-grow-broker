import React from 'react';
import clsx from 'clsx';
import { Card } from './Card';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** This column's rendered content becomes the mobile card's title. Exactly one column should set this. */
  mobilePrimary?: boolean;
  /** Dropped entirely from the mobile card (e.g. an ID column, or one already implied by context). Desktop still shows it. */
  mobileHidden?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingRowCount?: number;
  /** Rendered in the mobile card's footer (e.g. action buttons) — on desktop, put actions in their own column instead. */
  renderMobileActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
}

const ALIGN_CLASSES: Record<NonNullable<DataTableColumn<any>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * One table implementation for the whole app: a real <table> at md (768px)
 * and above, a stacked-card list below it — same data, same columns prop,
 * one breakpoint rule. Directly replaces the overflow-x-auto-only /
 * overflow-hidden-clipped patterns found in OrdersPositionsView.tsx and (in
 * the admin phase) CustomerList.tsx.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records found.',
  isLoading = false,
  loadingRowCount = 4,
  renderMobileActions,
  onRowClick,
}: DataTableProps<T>) {
  const primaryColumn = columns.find((c) => c.mobilePrimary) ?? columns[0];
  const mobileColumns = columns.filter((c) => c !== primaryColumn && !c.mobileHidden);

  if (isLoading) {
    return (
      <>
        <div className="hidden md:block space-y-2">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <div key={i} className="h-11 rounded-[var(--radius-md)] skeleton-shimmer" />
          ))}
        </div>
        <div className="md:hidden space-y-2">
          {Array.from({ length: loadingRowCount }).map((_, i) => (
            <div key={i} className="h-24 rounded-[var(--radius-md)] skeleton-shimmer" />
          ))}
        </div>
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[var(--text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet-landscape: real table, horizontal scroll as a fallback for narrow windows, not the primary responsive strategy */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-3 py-2.5 text-[11px] font-bold uppercase tracking-[var(--letter-spacing-wide)] text-[var(--text-tertiary)] whitespace-nowrap',
                    ALIGN_CLASSES[col.align ?? 'left']
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'border-b border-[var(--border-light)] transition-colors duration-[var(--duration-fast)]',
                  onRowClick && 'cursor-pointer hover:bg-[var(--bg-surface-elevated)]'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx('px-3 py-3 text-sm text-[var(--text-main)]', ALIGN_CLASSES[col.align ?? 'left'], col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet-portrait: stacked cards, same data */}
      <div className="md:hidden space-y-2.5">
        {rows.map((row) => (
          <Card
            key={rowKey(row)}
            padding="sm"
            interactive={Boolean(onRowClick)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="font-headline font-bold text-[var(--text-main)] mb-2">
              {primaryColumn.render(row)}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {mobileColumns.map((col) => (
                <div key={col.key} className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-[var(--letter-spacing-wide)] text-[var(--text-tertiary)]">
                    {col.header}
                  </span>
                  <span className="text-sm text-[var(--text-main)]">{col.render(row)}</span>
                </div>
              ))}
            </div>
            {renderMobileActions && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-light)]">
                {renderMobileActions(row)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
