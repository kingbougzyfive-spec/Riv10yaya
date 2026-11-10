const SECRET_KEY = /pass(word)?|secret|token|hash|authorization|cookie|api_?key|private_?key|(^|[a-z])uri$/i;
/** Copies a value for the audit trail with anything secret-looking blanked out, and long text trimmed. */
export function redact(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > 500 ? v.slice(0, 500) + "…" : v;
  if (v instanceof Date) return v;
  if (depth > 4) return "[nested]";
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth + 1));
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = SECRET_KEY.test(k) ? "[hidden]" : redact(x, depth + 1);
    return o;
  }
  return String(v);
}

