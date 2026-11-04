export type ReceiptReading = {
  amountNaira: number | null; date: string | null; time: string | null; reference: string | null; bank: string | null;
  payerName: string | null; beneficiaryName: string | null; beneficiaryAccount: string | null; transactionStatus: string | null;
  looksLikePaymentProof: boolean; legible: boolean; inconsistencies: string[]; confidence: "low" | "medium" | "high"; notes: string;
};

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const PROMPT = `You are helping a church finance officer check a payment receipt. Read the attached bank transfer receipt, screenshot or PDF.
Return ONLY a JSON object, no other text, with exactly these keys:
{"amountNaira": number|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "reference": string|null, "bank": string|null, "payerName": string|null, "beneficiaryName": string|null, "beneficiaryAccount": string|null, "transactionStatus": string|null, "looksLikePaymentProof": boolean, "legible": boolean, "inconsistencies": string[], "confidence": "low"|"medium"|"high", "notes": string}
Rules: use null for anything you cannot read clearly and never guess digits. Copy beneficiaryAccount exactly as shown, including any hidden digits. "transactionStatus" is the status printed on the receipt (e.g. Successful). "inconsistencies" lists only things you can actually see, such as misaligned fonts, mismatched figures, differing amounts in words and numbers, or editing artefacts, each in a few words; use an empty list when you see none. You cannot verify that money was received and must not say a payment is genuine or fake. "notes" is one short neutral sentence.`;

/** Advisory only: the result is shown next to the declared figures and never changes a payment's status. */
export async function readReceipt(data: Buffer, mime: string): Promise<ReceiptReading> {
  const block = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mime, data: data.toString("base64") } }
    : { type: "image", source: { type: "base64", media_type: mime, data: data.toString("base64") } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 600, messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }] }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || `The AI service returned ${res.status}.`);
  const text: string = (j.content ?? []).map((c: any) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI service returned an unreadable answer. Try again.");
  const o = JSON.parse(m[0]);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  return {
    amountNaira: typeof o.amountNaira === "number" ? o.amountNaira : null,
    date: str(o.date), time: str(o.time), reference: str(o.reference), bank: str(o.bank), payerName: str(o.payerName),
    beneficiaryName: str(o.beneficiaryName), beneficiaryAccount: str(o.beneficiaryAccount), transactionStatus: str(o.transactionStatus),
    looksLikePaymentProof: !!o.looksLikePaymentProof, legible: o.legible !== false,
    inconsistencies: Array.isArray(o.inconsistencies) ? o.inconsistencies.filter((x: unknown) => typeof x === "string").slice(0, 6).map((x: string) => x.slice(0, 100)) : [],
    confidence: ["low", "medium", "high"].includes(o.confidence) ? o.confidence : "low",
    notes: typeof o.notes === "string" ? o.notes.slice(0, 300) : "",
  };
}
