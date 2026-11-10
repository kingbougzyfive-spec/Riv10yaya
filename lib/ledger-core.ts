/** Pure rules behind the confirmed-payment ledger. */
export const normRef = (r?: string | null) => { const t = (r ?? "").trim().toUpperCase().replace(/\s+/g, ""); return t.length >= 4 ? t : undefined; };

export type Decision = "begin_review" | "confirm" | "payment_not_found" | "amount_mismatch" | "reject" | "request_resubmission" | "adjust";
export type Outcome = "matched" | "not_found" | "amount_mismatch" | "rejected" | "resubmission_requested";

/** What a finance decision means on the bank-matching side. Review start and adjustments don't touch reconciliation. */
export function outcomeFor(a: Decision): Outcome | null {
  return ({ confirm: "matched", payment_not_found: "not_found", amount_mismatch: "amount_mismatch", reject: "rejected", request_resubmission: "resubmission_requested" } as Record<string, Outcome>)[a] ?? null;
}
/** Only a confirmation creates money in the ledger, and only for a positive whole number of kobo. */
export const createsTransaction = (a: Decision, kobo?: number | null) => a === "confirm" && Number.isSafeInteger(kobo) && (kobo as number) > 0;
export const newRef = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
