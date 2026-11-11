"use client";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { nextSort, paginate, searchRows, sortRows, type Sort } from "@/lib/table";
import { EmptyState, ErrorState, LoadingRows } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: "left" | "right";
  /** Hide on very small screens' card layout label if the cell is self-explanatory. */
  hideLabel?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  /** Text searched by the search box. Omit to hide search. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra filter controls (selects, date pickers) shown beside the search box. */
  filters?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pageSize?: number;
  empty?: { title: string; hint?: string; action?: ReactNode };
  caption: string;
  onRowClick?: (row: T) => void;
};

/** Shared table: search, sort, pagination, filters slot, and a card layout on phones. */
export function DataTable<T>({ columns, rows, rowKey, searchText, searchPlaceholder, filters, loading, error, onRetry, pageSize = 15, empty, caption, onRowClick }: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);

  const view = useMemo(() => {
    const found = searchText ? searchRows(rows ?? [], q, searchText) : rows ?? [];
    const col = sort && columns.find((c) => c.key === sort.key);
    const sorted = col?.sortValue ? sortRows(found, sort, (r) => col.sortValue!(r)) : found;
    return paginate(sorted, page, pageSize);
  }, [rows, q, sort, page, pageSize, searchText, columns]);

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading || !rows) return <LoadingRows />;

  return (
    <div className="space-y-3">
      {(searchText || filters) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/65" aria-hidden />
              <input className="input !pl-9" type="search" aria-label={`Search ${caption}`} placeholder={searchPlaceholder ?? "Search…"} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          )}
          {filters}
        </div>
      )}
      {view.total === 0 ? (
        <EmptyState title={q ? "No matches" : empty?.title ?? "Nothing here yet"} hint={q ? "Try a different search or clear the filters." : empty?.hint} action={q ? undefined : empty?.action} />
      ) : (
        <div className="overflow-x-auto">
          <table className="dt-cards w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="text-left text-xs text-white/75">
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ChevronUp : ChevronDown;
                  return (
                    <th key={c.key} scope="col" className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined}>
                      {c.sortValue ? (
                        <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => { setSort(nextSort(sort, c.key)); setPage(1); }}>{c.header}<Icon className="h-3.5 w-3.5" aria-hidden /></button>
                      ) : c.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={rowKey(r)} className={`border-t border-white/10 ${onRowClick ? "cursor-pointer hover:bg-white/5" : ""}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.hideLabel ? "" : c.header} className={`px-3 py-2.5 align-top ${c.align === "right" ? "text-right" : ""}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view.total > pageSize && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-xs text-white/75">
          <span aria-live="polite">{view.from}–{view.to} of {view.total}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>Previous</button>
            <span className="self-center">Page {view.page} of {view.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={view.page >= view.pages} onClick={() => setPage(view.page + 1)}>Next</button>
          </div>
        </nav>
      )}
    </div>
  );
}
