import { Schema } from "mongoose";

const opts = { timestamps: true } as const;
const oid = (ref: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });
const kobo = { type: Number, validate: { validator: Number.isSafeInteger, message: "Money must be a whole number of kobo." } };

/** Roles and permissions as data. Enforcement stays in code (lib/rbac.ts); these rows are the catalogue shown to
 *  administrators and are kept in step with the code by lib/rbac-catalog.ts, so they can never grant anything. */
export const roleSchema = new Schema(
  { key: { type: String, required: true, unique: true }, label: { type: String, required: true }, level: { type: String, enum: ["province", "zone", "area", "parish", "event", "department", "member", "read_only"], required: true }, system: { type: Boolean, default: true }, permissions: [String] },
  opts,
);
export const permissionSchema = new Schema(
  { key: { type: String, required: true, unique: true }, description: String, roles: [String] },
  opts,
);

/** One row per calendar month. Reports and remittances link to it, so "which period" has one canonical answer. */
export const reportingPeriodSchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // "2026-10"
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    label: String,
    dueAt: { type: Date, required: true },
    /** open: normal. closed: still accepted but shown as late. locked: no new submissions (finance decisions continue). */
    status: { type: String, enum: ["open", "closed", "locked"], default: "open", index: true },
    statusHistory: [{ at: { type: Date, default: Date.now }, by: oid("User"), byName: String, status: String, reason: String }],
  },
  opts,
);
reportingPeriodSchema.index({ year: -1, month: -1 }, { unique: true });

/** A province-set obligation (levy) or a voluntary appeal (contribution). Payments against it are Remittance records
 *  (kind "levy") that point here, so levies and contributions never mix with the Youth Sunday 40% remittance. */
const obligationDef = (category: "levy" | "contribution") =>
  new Schema(
    {
      ref: { type: String, required: true, unique: true },
      title: { type: String, required: true, trim: true },
      description: String,
      category: { type: String, enum: ["levy", "contribution"], default: category },
      /** Fixed amount per parish, or null when parishes choose their own amount (contributions). */
      amountKobo: { ...kobo, min: 1 },
      targetKobo: { ...kobo, min: 1 },
      dueAt: Date,
      /** Empty = all parishes. Otherwise the zones, areas or parishes it applies to. */
      appliesTo: { zones: [oid("Zone")], areas: [oid("Area")], parishes: [oid("Parish")] },
      status: { type: String, enum: ["draft", "active", "closed"], default: "active", index: true },
      history: [{ at: { type: Date, default: Date.now }, by: oid("User"), byName: String, action: String, note: String }],
      createdBy: oid("User"),
    },
    opts,
  );
export const additionalLevySchema = obligationDef("levy");
export const contributionSchema = obligationDef("contribution");

const place = { zone: oid("Zone", { required: true, index: true }), area: oid("Area", { default: null }), parish: oid("Parish", { required: true, index: true }) };
const when = { month: { type: Number, min: 1, max: 12, required: true }, year: { type: Number, required: true }, period: oid("ReportingPeriod") };

/** The ledger of CONFIRMED money. A row exists only after a finance administrator matched a payment to the bank
 *  statement. Unverified evidence stays on the Remittance and never appears here. Rows are immutable. */
export const paymentTransactionSchema = new Schema(
  {
    ref: { type: String, required: true, unique: true }, // stable id, e.g. TXN-LX9K2ABCD (used by Google Sheets)
    remittance: oid("Remittance", { required: true, index: true }),
    /** "primary" for the original payment, otherwise the id of the extra payment. */
    paymentKey: { type: String, required: true },
    kind: { type: String, enum: ["yst", "levy"], required: true },
    category: { type: String, enum: ["levy", "contribution"], default: "levy" },
    ...place,
    ...when,
    amountKobo: { ...kobo, required: true, min: 1 },
    declaredKobo: kobo,
    /** Normalised bank reference. A given reference can be confirmed only once. */
    bankReference: String,
    confirmedBy: oid("User"),
    confirmedByName: String,
    confirmedAt: { type: Date, default: Date.now },
  },
  opts,
);
paymentTransactionSchema.index({ remittance: 1, paymentKey: 1 }, { unique: true }); // a payment is confirmed once
paymentTransactionSchema.index({ bankReference: 1 }, { unique: true, partialFilterExpression: { bankReference: { $type: "string" } } }); // a bank reference is used once
paymentTransactionSchema.index({ parish: 1, year: 1, month: 1 });
paymentTransactionSchema.index({ zone: 1, year: 1, month: 1 });

/** Every finance decision, forever: who decided what, on which payment, why, and what amounts were involved. Immutable. */
export const financialApprovalSchema = new Schema(
  {
    remittance: oid("Remittance", { required: true, index: true }),
    paymentKey: { type: String, default: "primary" },
    ...place,
    ...when,
    action: { type: String, enum: ["begin_review", "confirm", "payment_not_found", "amount_mismatch", "reject", "request_resubmission", "adjust"], required: true },
    fromStatus: String,
    toStatus: String,
    declaredKobo: kobo,
    seenKobo: kobo,
    confirmedKobo: kobo,
    adjustmentKobo: { type: Number, validate: { validator: Number.isSafeInteger } },
    bankReference: String,
    reason: String,
    note: String,
    evidence: oid("Media"),
    transaction: oid("PaymentTransaction"),
    decidedBy: oid("User", { required: true }),
    decidedByName: String,
    decidedByRole: String,
    decidedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
financialApprovalSchema.index({ remittance: 1, decidedAt: -1 });
financialApprovalSchema.index({ parish: 1, year: 1, month: 1 });

/** Where each payment stands against the bank statement. One row per payment (latest state); the full decision
 *  history is in FinancialApproval. */
export const bankReconciliationSchema = new Schema(
  {
    remittance: oid("Remittance", { required: true }),
    paymentKey: { type: String, default: "primary" },
    ...place,
    ...when,
    declaredKobo: kobo,
    bankKobo: kobo, // what the statement showed (0 when nothing was found)
    bankReference: String,
    outcome: { type: String, enum: ["matched", "not_found", "amount_mismatch", "rejected", "resubmission_requested"], required: true, index: true },
    reconciledBy: oid("User"),
    reconciledByName: String,
    reconciledAt: { type: Date, default: Date.now },
    transaction: oid("PaymentTransaction"),
    note: String,
  },
  opts,
);
bankReconciliationSchema.index({ remittance: 1, paymentKey: 1 }, { unique: true });
bankReconciliationSchema.index({ year: -1, month: -1, outcome: 1 });
