"use client";
import { useSyncExternalStore } from "react";

/** True when the browser reports a connection. `navigator.onLine` can say "online" on a dead network, so
 *  nothing here ever treats it as proof that a request succeeded; only a real server response does that. */
const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
