/** Tiny client helper: JSON in/out, throws Error with the server's friendly message.
 *
 *  Offline rule: any write (POST/PUT/PATCH/DELETE) is refused up front while the browser is offline, and a
 *  network failure is reported as "not sent". Success is only ever reported after a real 2xx server response,
 *  so a payment, report or approval can never look confirmed when it was not. */
export class OfflineError extends Error {
  offline = true;
  constructor(msg = "You're offline. Nothing was sent or saved. Please reconnect and try again.") { super(msg); }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (method !== "GET" && typeof navigator !== "undefined" && navigator.onLine === false) throw new OfflineError();
  // Reading is safe to repeat, so a slow start or a brief network or database hiccup is retried quietly before anyone sees an error.
  // Writes are never repeated automatically: a payment or approval must not be sent twice.
  const attempts = method === "GET" ? 3 : 1;
  let failure: Error = new Error("Request failed");
  for (let n = 0; n < attempts; n++) {
    if (n > 0) await wait(n === 1 ? 700 : 1600);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: init?.json ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
        body: init?.json ? JSON.stringify(init.json) : init?.body,
      });
    } catch {
      failure = new OfflineError(method === "GET" ? "Couldn't reach the server. Please check your connection." : "Couldn't reach the server. Nothing was confirmed. Please check your connection and try again.");
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    failure = new Error(data?.error || (data?.requestId ? `Something went wrong (ref ${data.requestId}).` : `Request failed (${res.status})`));
    if (![500, 502, 503, 504].includes(res.status)) throw failure; // a real answer (wrong input, not allowed, not found): do not retry
  }
  throw failure;
}
