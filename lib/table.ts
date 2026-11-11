/** Pure table logic (search, sort, page) so it can be tested without a browser. */
export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir } | null;

const norm = (v: unknown) => (v == null ? "" : String(v).toLowerCase());

export function searchRows<T>(rows: T[], q: string, text: (r: T) => string): T[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter((r) => { const t = text(r).toLowerCase(); return terms.every((x) => t.includes(x)); });
}

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // blanks always last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortRows<T>(rows: T[], sort: Sort, value: (r: T, key: string) => unknown): T[] {
  if (!sort) return rows;
  const m = sort.dir === "asc" ? 1 : -1;
  return rows.map((r, i) => [r, i] as const).sort((x, y) => {
    const a = value(x[0], sort.key), b = value(y[0], sort.key);
    if (a == null || b == null) return compareValues(a, b); // blanks last in both directions
    return compareValues(a, b) * m || x[1] - y[1];
  }).map((x) => x[0]);
}

export function nextSort(cur: Sort, key: string): Sort {
  if (!cur || cur.key !== key) return { key, dir: "asc" };
  if (cur.dir === "asc") return { key, dir: "desc" };
  return null;
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  return { rows: rows.slice(start, start + size), page: p, pages, total: rows.length, from: rows.length ? start + 1 : 0, to: Math.min(rows.length, start + size) };
}
export { norm };
