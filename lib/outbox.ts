"use client";
/** A small IndexedDB outbox for actions that are SAFE to send late.
 *
 *  Safe means: idempotent, non-financial, no approval, no submission. Today that is exactly one thing:
 *  marking your own notifications as read. The allowlist is checked on enqueue AND on flush, so nothing
 *  else can ever be queued, even by mistake. Everything else (payments, remittances, reports, approvals,
 *  uploads, member or organisation changes) needs a live server response and is refused offline.
 *
 *  Queued items are shown to the person as "not sent yet", never as done. They are cleared on sign-out. */
const DB = "yaya-outbox";
const STORE = "items";

const ALLOWED: { kind: string; method: string; path: string }[] = [
  { kind: "notification-read", method: "PATCH", path: "/api/notifications" },
];

export type OutboxItem = { id?: number; kind: string; method: string; url: string; body?: unknown; at: number };

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  open().then((db) => new Promise<T>((res, rej) => { const rq = fn(db.transaction(STORE, mode).objectStore(STORE)); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }));

const allowed = (i: Pick<OutboxItem, "kind" | "method" | "url">) => ALLOWED.some((a) => a.kind === i.kind && a.method === i.method.toUpperCase() && a.path === i.url);
const changed = () => { try { window.dispatchEvent(new Event("outbox-change")); } catch {} };

export async function enqueue(item: Omit<OutboxItem, "at" | "id">): Promise<boolean> {
  if (!allowed(item)) return false;
  try { await run("readwrite", (s) => s.add({ ...item, method: item.method.toUpperCase(), at: Date.now() })); changed(); return true; } catch { return false; }
}
export async function pendingCount(): Promise<number> {
  try { return await run("readonly", (s) => s.count()); } catch { return 0; }
}
export async function clearOutbox() {
  try { await run("readwrite", (s) => s.clear()); changed(); } catch {}
}

let flushing = false;
/** Send queued items. Removes an item on success or on a permanent refusal (400/403/404); keeps it on
 *  network errors, 401 (signed out) and 5xx so it can be tried again. */
export async function flushOutbox(): Promise<number> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = (await run("readonly", (s) => s.getAll())) as OutboxItem[];
    for (const it of items) {
      if (!allowed(it)) { await run("readwrite", (s) => s.delete(it.id!)); continue; }
      try {
        const r = await fetch(it.url, { method: it.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(it.body ?? {}) });
        if (r.ok) { await run("readwrite", (s) => s.delete(it.id!)); sent++; }
        else if ([400, 403, 404].includes(r.status)) await run("readwrite", (s) => s.delete(it.id!));
        else break;
      } catch { break; }
    }
  } catch {} finally { flushing = false; changed(); }
  return sent;
}
