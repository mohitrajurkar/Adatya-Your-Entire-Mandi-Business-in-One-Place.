import * as React from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState, SkeletonTable } from './feedback';

/**
 * The table used across the application.
 *
 * Every list was previously a hand-rolled <table> with no sorting, no paging
 * and no search; Farmers and Purchases rendered every row they had. On a
 * phone the columns simply overflowed, so this renders a stacked card list
 * below the `mobileBreakpoint` instead of a horizontally scrolling grid.
 */

export interface Column<Row> {
  key: string;
  header: string;
  /** Cell contents. Keep formatting here, never recalculation. */
  render: (row: Row) => React.ReactNode;
  /** Value used for sorting and searching. Omit to make the column inert. */
  value?: (row: Row) => string | number | null | undefined;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Hide on the stacked mobile layout, for low-value columns. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<Row> {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string | number;
  loading?: boolean;
  onRowClick?: (row: Row) => void;

  searchable?: boolean;
  searchPlaceholder?: string;
  /** 0 disables paging. */
  pageSize?: number;

  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;

  /** Rendered above the table, beside the search box. */
  toolbar?: React.ReactNode;
  caption?: string;
  className?: string;
}

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  loading = false,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search…',
  pageSize = 25,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  toolbar,
  caption,
  className,
}: DataTableProps<Row>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  // Keeps typing responsive on long lists.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter(row =>
      columns.some(column => {
        const raw = column.value?.(row);
        return raw !== null && raw !== undefined && String(raw).toLowerCase().includes(needle);
      })
    );
  }, [rows, columns, deferredQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find(c => c.key === sort.key);
    if (!column?.value) return filtered;

    // Sorted on a copy; the caller's array is never mutated.
    return [...filtered].sort((a, b) => {
      const left = column.value!(a);
      const right = column.value!(b);

      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;

      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true });

      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sort, columns]);

  const paged = useMemo(() => {
    if (pageSize <= 0) return sorted;
    return sorted.slice(page * pageSize, page * pageSize + pageSize);
  }, [sorted, page, pageSize]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  if (safePage !== page) {
    // Deleting rows can leave the view past the end.
    setPage(safePage);
  }

  const toggleSort = (column: Column<Row>) => {
    if (!column.value || column.sortable === false) return;
    setPage(0);
    setSort(current =>
      current?.key === column.key
        ? current.direction === 'asc'
          ? { key: column.key, direction: 'desc' }
          : null
        : { key: column.key, direction: 'asc' }
    );
  };

  const header = (searchable || toolbar) && (
    <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
      {searchable ? (
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-control border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-brand-600 focus-visible:outline-none"
          />
        </div>
      ) : (
        <span />
      )}
      {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
    </div>
  );

  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-card border border-line bg-surface', className)}>
        {header}
        <SkeletonTable rows={5} columns={Math.min(columns.length, 5)} />
      </div>
    );
  }

  if (rows.length === 0 || sorted.length === 0) {
    return (
      <div className={cn('overflow-hidden rounded-card border border-line bg-surface', className)}>
        {header}
        <EmptyState
          icon={emptyIcon}
          title={rows.length === 0 ? emptyTitle : 'No matches'}
          description={
            rows.length === 0
              ? emptyDescription
              : `Nothing matches “${query.trim()}”. Try a different search.`
          }
          action={rows.length === 0 ? emptyAction : undefined}
        />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-surface', className)}>
      {header}

      {/* Desktop: a real table, so screen readers get row and column context. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              {columns.map(column => {
                const isSorted = sort?.key === column.key;
                const canSort = !!column.value && column.sortable !== false;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={isSorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={cn(
                      'px-4 py-2.5 text-2xs font-semibold tracking-wide text-ink-muted uppercase',
                      column.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
                          column.align === 'right' && 'flex-row-reverse'
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort!.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          )
                        ) : (
                          <span className="inline-block w-3" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-line last:border-0',
                  onRowClick && 'cursor-pointer transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted'
                )}
              >
                {columns.map(column => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-ink',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.className
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards. Columns do not fit on a phone. */}
      <ul className="divide-y divide-line md:hidden">
        {paged.map(row => {
          const [primary, ...rest] = columns;
          return (
            <li key={rowKey(row)}>
              <div
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn('block px-4 py-3', onRowClick && 'active:bg-surface-muted')}
              >
                <div className="mb-1.5 font-semibold text-ink">{primary.render(row)}</div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {rest
                    .filter(column => !column.hideOnMobile)
                    .map(column => (
                      <div key={column.key} className="flex items-baseline justify-between gap-2">
                        <dt className="text-2xs text-ink-subtle">{column.header}</dt>
                        <dd className="text-sm text-ink">{column.render(row)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </li>
          );
        })}
      </ul>

      {pageSize > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
          <p className="text-2xs text-ink-muted">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1 text-2xs text-ink-muted">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
