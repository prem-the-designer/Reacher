/**
 * DataTable — single shared table component per §4.6
 * Used by Activity, Users, Logs, Import errors. Building a second is a bug.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from './Button';
import { Select } from './Select';
import type { PaginationState } from '@/types';

// ── Column definition ─────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render function — receives the row, returns ReactNode */
  render: (row: T) => React.ReactNode;
  /** right-aligns numeric/timestamp columns */
  align?: 'left' | 'right' | 'center';
  /** hide on mobile stacked card view */
  mobileHidden?: boolean;
  /** used as the "title" field in mobile card view */
  mobileTitle?: boolean;
  width?: string;
}

// ── State types ───────────────────────────────────────────────────────────────

export type DataTableState =
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'no-results'
  | 'error';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  state: DataTableState;
  errorMessage?: string;
  onRetry?: () => void;
  onClearFilters?: () => void;
  /** Unique key for each row */
  rowKey: (row: T) => string;
  /** Called when a row is clicked (opens detail dialog) */
  onRowClick?: (row: T) => void;
  /** Row action menu render */
  rowActions?: (row: T) => React.ReactNode;
  /** Dense variant (40px rows) for Logs */
  dense?: boolean;
  /** Optional caption for accessibility */
  caption?: string;
  /** Pagination */
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Toolbar slot */
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows<T>({ columns, count = 5, dense }: { columns: DataTableColumn<T>[]; count?: number; dense?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {columns.map((col) => (
            <td key={col.key} className={cn('px-4 border-b border-border', dense ? 'py-2.5' : 'py-3')}>
              <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${60 + ((i + col.key.length) % 3) * 15}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function DataTableInner<T>(
  {
    columns,
    data,
    state,
    errorMessage,
    onRetry,
    onClearFilters,
    rowKey,
    onRowClick,
    rowActions,
    dense = false,
    caption,
    pagination,
    onPageChange,
    onPageSizeChange,
    toolbar,
    emptyTitle = 'No data yet',
    emptyDescription = 'Items will appear here once created.',
  }: DataTableProps<T>,
  _ref: React.Ref<HTMLDivElement>
) {
  const rowH = dense ? 'py-2.5' : 'py-3';

  const pageSizeOptions = [
    { value: '10', label: '10 / page' },
    { value: '25', label: '25 / page' },
    { value: '50', label: '50 / page' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      )}

      {/* Error alert above table */}
      {state === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              {errorMessage ?? 'Failed to load data.'}
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="shrink-0 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Table wrapper — horizontal scroll for wide log tables on mobile */}
      <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
        <table className="w-full text-sm border-collapse" aria-busy={state === 'loading'}>
          {caption && <caption className="sr-only">{caption}</caption>}

          {/* Sticky header */}
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap border-b border-border',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.mobileHidden ? 'hidden sm:table-cell' : ''
                  )}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border text-right w-12">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {/* Loading skeleton */}
            {state === 'loading' && (
              <SkeletonRows columns={columns} count={5} dense={dense} />
            )}

            {/* Data rows */}
            {state === 'loaded' && data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
                className={cn(
                  'border-b border-border last:border-0 transition-colors duration-150',
                  onRowClick ? 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A1A1A1]/80' : ''
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 text-sm text-foreground tabular-nums',
                      rowH,
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.mobileHidden ? 'hidden sm:table-cell' : ''
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className={cn('px-4 text-right', rowH)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}

            {/* Empty state */}
            {(state === 'empty' || state === 'no-results') && (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Search className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {state === 'no-results' ? 'No results found' : emptyTitle}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {state === 'no-results'
                          ? 'Try adjusting your filters or search term.'
                          : emptyDescription}
                      </p>
                    </div>
                    {state === 'no-results' && onClearFilters && (
                      <Button variant="outline" size="sm" onClick={onClearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && onPageChange && state === 'loaded' && (
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          {onPageSizeChange && (
            <Select
              options={pageSizeOptions}
              value={String(pagination.pageSize)}
              onChange={(v) => onPageSizeChange(Number(v))}
              className="w-32"
              aria-label="Rows per page"
            />
          )}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {pagination.total === 0
                ? '0 results'
                : `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTable = React.forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => React.ReactElement;
