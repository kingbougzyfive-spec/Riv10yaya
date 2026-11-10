/** Tiny client helper: JSON in/out, throws Error with the server's friendly message.
 *
 *  Offline rule: any write (POST/PUT/PATCH/DELETE) is refused up front while the browser is offline, and a
 *  network failure is reported as "not sent". Success is only ever reported after a real 2xx server response,
 *  so a payment, report or approval can never look confirmed when it was not. */
export class OfflineError extends Error {
  offline = true;
  constructor(msg = "You're offline. Nothing was sent or saved. Please reconnect and try again.") { super(msg); }
}

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (method !== "GET" && typeof navigator !== "undefined" && navigator.onLine === false) throw new OfflineError();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.json ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
      body: init?.json ? JSON.stringify(init.json) : init?.body,
    });
  } catch {
    throw new OfflineError(method === "GET" ? "Couldn't reach the server. Please check your connection." : "Couldn't reach the server. Nothing was confirmed. Please check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || (data?.requestId ? `Something went wrong (ref ${data.requestId}).` : `Request failed (${res.status})`));
  return data as T;
}
