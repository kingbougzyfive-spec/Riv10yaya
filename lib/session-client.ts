"use client";
import { api } from "@/lib/fetcher";
import { clearOutbox } from "@/lib/outbox";

/** Sign out and remove everything this device kept for the signed-in person. */
export async function signOutEverywhereLocal() {
  await clearOutbox();
  try { (await navigator.serviceWorker?.getRegistration())?.active?.postMessage({ type: "CLEAR_USER_CACHES" }); } catch {}
  await api("/api/auth/logout", { method: "POST" });
}
