export type ReceiptReading = { amountNaira: number | null; date: string | null; reference: string | null; bank: string | null; payerName: string | null; looksLikePaymentProof: boolean; confidence: "low" | "medium" | "high"; notes: string };

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const PROMPT = `You are helping a church finance officer check a payment receipt. Read the attached bank transfer receipt/screenshot.
Return ONLY a JSON object, no other text, with exactly these keys:
{"amountNaira": number|null, "date": "YYYY-MM-DD"|null, "reference": string|null, "bank": string|null, "payerName": string|null, "looksLikePaymentProof": boolean, "confidence": "low"|"medium"|"high", "notes": string}
Use null for anything you cannot read clearly. Never guess digits. In "notes", mention anything suspicious (edited-looking image, mismatched figures, not a payment receipt) in one short sentence.`;

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
  return {
    amountNaira: typeof o.amountNaira === "number" ? o.amountNaira : null,
    date: typeof o.date === "string" ? o.date : null,
    reference: typeof o.reference === "string" ? o.reference : null,
    bank: typeof o.bank === "string" ? o.bank : null,
    payerName: typeof o.payerName === "string" ? o.payerName : null,
    looksLikePaymentProof: !!o.looksLikePaymentProof,
    confidence: ["low", "medium", "high"].includes(o.confidence) ? o.confidence : "low",
    notes: typeof o.notes === "string" ? o.notes.slice(0, 300) : "",
  };
}
