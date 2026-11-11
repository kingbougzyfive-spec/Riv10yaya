import { Schema, type Connection, type Model } from "mongoose";

import { ROLES } from "./roles";
import { orgChain, reportShapeProblem } from "./org-chain";
import { slugify } from "./slug";
import { periodDue, periodKey, periodLabel } from "./period";
import { additionalLevySchema, bankReconciliationSchema, contributionSchema, financialApprovalSchema, paymentTransactionSchema, permissionSchema, reportingPeriodSchema, roleSchema } from "./schemas-extra";
export { ROLES, ROLE_LABELS } from "./roles";
export type { Role } from "./roles";
import type { Role } from "./roles";

const opts = { timestamps: true } as const;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
    area: { type: Schema.Types.ObjectId, ref: "Area" },
    parish: { type: Schema.Types.ObjectId, ref: "Parish" },
    active: { type: Boolean, default: true },
    /** Notification preferences (members manage their own). In-app notices are always on. */
    prefs: { email: { type: Boolean, default: true }, sms: { type: Boolean, default: true }, push: { type: Boolean, default: true }, /** categories the person has switched off (only optional ones can be) */ mute: [String] },
    lastLoginAt: Date,
    /** Bumped on password change/reset, role change and deactivation so older sessions stop working. */
    sessionVersion: { type: Number, default: 0 },
    /** Temporary password in use: the person must choose their own before doing anything else. */
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date,
    /** Created from BOOTSTRAP_ADMIN_* environment variables. */
    bootstrap: { type: Boolean, default: false },
  },
  opts,
);

const zoneSchema = new Schema(
  {
    /** true only for rows created by the optional "sample data" button, so they can be told apart from (and removed without touching) real records */
    isSample: { type: Boolean, default: false, index: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    /** false => standalone zone: parishes sit directly under it */
    hasAreas: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    description: String,
  },
  opts,
);

const areaSchema = new Schema(
  {
    /** true only for rows created by the optional "sample data" button, so they can be told apart from (and removed without touching) real records */
    isSample: { type: Boolean, default: false, index: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    active: { type: Boolean, default: true },
  },
  opts,
);
areaSchema.index({ zone: 1, nameKey: 1 }, { unique: true });

const parishSchema = new Schema(
  {
    /** true only for rows created by the optional "sample data" button, so they can be told apart from (and removed without touching) real records */
    isSample: { type: Boolean, default: false, index: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    /** null for parishes directly under a standalone zone */
    area: { type: Schema.Types.ObjectId, ref: "Area", default: null, index: true },
    address: String,
    active: { type: Boolean, default: true },
    transfers: [
      {
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: "User" },
        fromZone: Schema.Types.ObjectId,
        fromArea: Schema.Types.ObjectId,
        toZone: Schema.Types.ObjectId,
        toArea: Schema.Types.ObjectId,
        reason: String,
      },
    ],
  },
  opts,
);
parishSchema.index({ zone: 1, area: 1, nameKey: 1 }, { unique: true });

/** Single document (key = "site") holding all CMS-managed content. */
const siteSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

/** Images are stored in the database so they follow the data during failover/sync. */
const mediaSchema = new Schema(
  {
    name: { type: String, required: true },
    mime: { type: String, required: true },
    size: Number,
    width: Number,
    height: Number,
    data: { type: Buffer, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** Payment evidence is private: only the owning parish and finance/provincial staff may fetch it. */
    private: { type: Boolean, default: false, index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish" },
    /** SHA-256 of the file bytes. Used to spot the same receipt being uploaded again. */
    hash: { type: String, index: true },
    /** Governance documents (minutes, policies…) are private files tied to an organisational level. */
    document: { type: Boolean, default: false },
    docOrg: { level: String, zone: Schema.Types.ObjectId, area: Schema.Types.ObjectId, parish: Schema.Types.ObjectId },
  },
  opts,
);

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    actorRole: String,
    actorEmail: String,
    action: { type: String, required: true, index: true },
    /** Human label of the affected record (an email, a parish name, a reference). */
    target: String,
    /** Kind and id of the affected record, e.g. "remittance" / "66f...". */
    entity: String,
    entityId: String,
    /** Previous and new values for changes. Never contains passwords or secrets. */
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    detail: Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    requestId: String,
  },
  opts,
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });

/** Mirror of the connection list (URIs encrypted) so a fresh server can recover it. */
const systemConfigSchema = new Schema(
  { key: { type: String, unique: true, required: true }, value: Schema.Types.Mixed },
  opts,
);


const historyEntry = {
  at: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: "User" },
  byName: String,
  action: String,
  note: String,
  evidenceId: { type: Schema.Types.ObjectId, ref: "Media" },
  /** Finance decisions also record why, what bank reference was matched and what amount was seen or confirmed. */
  reason: String,
  reference: String,
  amountKobo: Number,
  paymentId: String,
};

const paymentSchema = new Schema(
  {
    amountKobo: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    reference: String,
    evidenceId: { type: Schema.Types.ObjectId, ref: "Media" },
    remarks: String,
    status: { type: String, default: "submitted" },
    confirmedKobo: Number,
    seenKobo: Number,
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    analysis: Schema.Types.Mixed,
    checks: Schema.Types.Mixed,
    history: [historyEntry],
  },
  { timestamps: true },
);

/** Money records. kind "yst" = Youth Sunday Thanksgiving 40% remittance; "levy" = any other obligation. Never mixed. */
const remittanceSchema = new Schema(
  {
    kind: { type: String, enum: ["yst", "levy"], required: true, index: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", default: null, index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", required: true, index: true },
    month: { type: Number, min: 1, max: 12, required: true },
    year: { type: Number, required: true },
    description: String, // levies
    /** Canonical reporting period (linked automatically from month/year) and, for levies, the obligation it answers. */
    period: { type: Schema.Types.ObjectId, ref: "ReportingPeriod", index: true },
    levy: { type: Schema.Types.ObjectId, ref: "AdditionalLevy" },
    contribution: { type: Schema.Types.ObjectId, ref: "Contribution" },
    /** levy = an obligation set by the province; contribution = a voluntary gift. Reported separately. */
    category: { type: String, enum: ["levy", "contribution"], default: "levy" },
    offeringKobo: Number, // yst: total offering collected
    percentBp: Number, // yst: percentage in force when submitted (snapshot)
    requiredKobo: Number, // yst: calculated obligation
    amountKobo: { type: Number, required: true }, // amount the parish says it paid
    paidAt: { type: Date, required: true },
    reference: String,
    evidenceId: { type: Schema.Types.ObjectId, ref: "Media" },
    remarks: String,
    status: { type: String, enum: ["submitted", "awaiting_verification", "confirmed", "payment_not_found", "amount_mismatch", "rejected", "resubmission_required"], default: "submitted", index: true },
    confirmedKobo: Number, // what finance actually saw in the bank
    seenKobo: Number, // amount finance found when it did not match (never counted as confirmed)
    /** Additional payments toward the same obligation (part payments, top-ups). Each has its own evidence and verification. */
    payments: [paymentSchema],
    /** Manual financial adjustments. Signed kobo, a reason is mandatory, and they are never deleted. */
    adjustments: [{ amountKobo: { type: Number, required: true }, reason: { type: String, required: true }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, at: { type: Date, default: Date.now } }],
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    /** Advisory AI reading of the receipt. Never changes status by itself. */
    analysis: Schema.Types.Mixed,
    /** Deterministic checks run at submission (repeated file / repeated reference). Prompts a human look, proves nothing. */
    checks: Schema.Types.Mixed,
    /** Append-only trail. Original submitted values are never overwritten by reviewers. */
    history: [historyEntry],
  },
  opts,
);
remittanceSchema.index({ parish: 1, month: 1, year: 1 }, { unique: true, partialFilterExpression: { kind: "yst" } });

const reportRevision = {
  revision: Number,
  at: Date,
  by: { type: Schema.Types.ObjectId, ref: "User" },
  byName: String,
  contact: { fullName: String, phone: String, altPhone: String },
  activity: Schema.Types.Mixed,
  note: String,
};

const reportSchema = new Schema(
  {
    /** Human-readable unique report ID, e.g. RPT-P-7K3M9X. */
    reportId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ["draft", "submitted", "completed", "revision_requested", "incomplete"], default: "submitted", index: true },
    /** Reviewer decisions (complete / request revision / mark incomplete). Append-only. */
    reviews: [{ at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, role: String, action: String, note: String }],
    revision: { type: Number, default: 1 },
    /** Append-only: the previous version of the contact snapshot and answers each time a report is revised. */
    history: [reportRevision],
    type: { type: String, enum: ["parish", "area", "zone"], required: true, index: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", default: null, index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", default: null, index: true },
    month: { type: Number, min: 1, max: 12, required: true },
    year: { type: Number, required: true },
    /** Names at the time of submission (ids remain the canonical identifiers). */
    names: { zone: String, area: String, parish: String },
    /** Historical snapshot: never overwritten when the administrator later edits their account. */
    contact: { fullName: String, phone: String, altPhone: String }, // required when submitting (validated by zod); a draft may be partial
    activity: Schema.Types.Mixed,
    rollup: Schema.Types.Mixed,
    remittance: { type: Schema.Types.ObjectId, ref: "Remittance" },
    period: { type: Schema.Types.ObjectId, ref: "ReportingPeriod", index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, default: Date.now },
  },
  opts,
);
reportSchema.index({ type: 1, zone: 1, area: 1, parish: 1, month: 1, year: 1 }, { unique: true });

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    /** Public address, /events/<slug>. Generated from the title; the old id address keeps working. */
    slug: { type: String, unique: true, sparse: true },
    description: String,
    venue: String,
    mapUrl: String,
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    registrationDeadline: Date,
    capacity: { type: Number, default: 0 }, // 0 = unlimited
    eligibility: String,
    organizers: String,
    contactName: String,
    contactPhone: String,
    contactEmail: String,
    flyerId: { type: Schema.Types.ObjectId, ref: "Media" },
    status: { type: String, enum: ["draft", "published", "cancelled"], default: "draft", index: true },
    registrationOpen: { type: Boolean, default: true },
    customFields: [{ key: String, label: String, type: { type: String, enum: ["text", "select", "yesno"], default: "text" }, required: Boolean, options: [String] }],
    seriesId: String, // recurring events share a series id
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const registrationSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    regId: { type: String, required: true, unique: true }, // unique registration ID
    reference: { type: String, required: true, unique: true }, // human reference, also encoded in the QR
    name: { type: String, required: true },
    phone: { type: String, required: true },
    phoneKey: { type: String, required: true },
    email: String,
    zone: { type: Schema.Types.ObjectId, ref: "Zone" },
    area: { type: Schema.Types.ObjectId, ref: "Area" },
    parish: { type: Schema.Types.ObjectId, ref: "Parish" },
    answers: Schema.Types.Mixed,
    status: { type: String, enum: ["registered", "cancelled"], default: "registered" },
    checkedInAt: Date,
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** Set when a signed-in member registered themselves. */
    member: { type: Schema.Types.ObjectId, ref: "Member", index: true },
    reminderAt: Date,
    cancelNotifiedAt: Date,
  },
  opts,
);
registrationSchema.index({ event: 1, phoneKey: 1 }, { unique: true });

const memberSchema = new Schema(
  {
    memberId: { type: String, required: true, unique: true }, // e.g. YM-48392
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    phoneKey: { type: String, required: true, unique: true },
    /** Earlier phone keys, so attendance and registration history stays attached after a number changes. */
    oldPhoneKeys: [String],
    email: String,
    zone: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", default: null, index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", index: true }, // optional: a member may join before being placed in a parish
    active: { type: Boolean, default: true }, // derived from status; kept for the attendance code
    status: { type: String, enum: ["active", "inactive", "visitor", "transferred"], default: "active", index: true },
    category: { type: String, default: "Youth", index: true },
    dob: Date,
    gender: { type: String, enum: ["male", "female", ""], default: "" },
    joinedAt: { type: Date, default: Date.now },
    departments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    leadership: { title: String, level: { type: String, enum: ["parish", "area", "zone", "province", ""], default: "" }, since: Date },
    /** Minors: guardian details and consent. verifiedAt is set by a parish administrator (or the admin who registered them). */
    guardian: { name: String, phone: String, relationship: String, consentAt: Date, verifiedAt: Date, verifiedByName: String },
    consent: { privacyAt: Date, by: { type: String, enum: ["self", "admin", ""], default: "" } },
    volunteer: [{ title: String, event: { type: Schema.Types.ObjectId, ref: "Event" }, at: Date, hours: Number, note: String, byName: String, createdAt: { type: Date, default: Date.now } }],
    /** Pastoral follow-up. Never shown to the member and never shared beyond authorised administrators. */
    followUps: [{ kind: { type: String, enum: ["call", "visit", "message", "meeting", "other"], default: "call" }, note: String, outcome: String, nextAt: Date, done: { type: Boolean, default: false }, at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String }],
    /** Append-only record of changes to important information. */
    changes: [{ at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, field: String, from: String, to: String, reason: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);


const sessionSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    kind: { type: String, default: "other" }, // youth_sunday, meeting, convention, retreat …
    level: { type: String, enum: ["parish", "area", "zone", "province"], required: true, index: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", index: true },
    event: { type: Schema.Types.ObjectId, ref: "Event" },
    date: { type: Date, required: true, index: true },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    token: { type: String, required: true, unique: true }, // unguessable; encoded in the QR
    locationCheck: { enabled: { type: Boolean, default: false }, lat: Number, lng: Number, radiusM: { type: Number, default: 300 } },
    forceClosed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const attendanceSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: "AttendanceSession", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    registration: { type: Schema.Types.ObjectId, ref: "Registration" },
    name: { type: String, required: true },
    phoneKey: { type: String, required: true },
    visitor: { type: Boolean, default: false },
    // attribution for reporting
    zone: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", index: true },
    at: { type: Date, default: Date.now }, // server timestamp, never client-supplied
    method: { type: String, enum: ["qr", "manual"], default: "qr" },
    // location is optional, permission-based, and only ever an extra signal. QR alone is not proof of presence.
    location: { provided: Boolean, withinRadius: Boolean, distanceM: Number },
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
    addedByName: String,
    note: String,
  },
  opts,
);
attendanceSchema.index({ session: 1, phoneKey: 1 }, { unique: true });

const announcementSchema = new Schema(
  {
    /** true only for rows created by the optional "sample data" button, so they can be told apart from (and removed without touching) real records */
    isSample: { type: Boolean, default: false, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    imageId: { type: Schema.Types.ObjectId, ref: "Media" },
    pinned: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const departmentSchema = new Schema(
  {
    /** true only for rows created by the optional "sample data" button, so they can be told apart from (and removed without touching) real records */
    isSample: { type: Boolean, default: false, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    headName: String,
    imageId: { type: Schema.Types.ObjectId, ref: "Media" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    /** Provincial departments appear on the public site. Zone, area and parish departments are internal. */
    level: { type: String, enum: ["province", "zone", "area", "parish"], default: "province", index: true },
    zone: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", index: true },
    responsibilities: [String],
  },
  opts,
);

/** One-time password reset links. Only a hash of the token is stored; expired rows are removed by MongoDB. */
const resetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  opts,
);

/** A browser/device that agreed to receive push notifications. Dead subscriptions are removed when the push service reports them gone. */
const pushSchema = new Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    ua: { type: String, default: "" },
    /** Set when the person was signed in while subscribing, which is what makes targeted push possible. */
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  opts,
);

/** In-app notifications for administrators (payment flags, report reviews, parish responses). */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: String,
    link: String,
    readAt: Date,
    /** Which event produced it, its category (drives preferences) and the send it belongs to. */
    event: String,
    category: { type: String, default: "general" },
    batch: { type: Schema.Types.ObjectId, ref: "NotificationLog", index: true },
    /** Stops a reminder being sent twice to the same person. */
    dedupe: { type: String, index: true },
    /** What happened on each outside channel for this person. In-app always exists. */
    delivery: { email: String, push: String },
  },
  opts,
);
notificationSchema.index({ user: 1, createdAt: -1 });

/** One record per send (a broadcast or a system event): who it was for, what was delivered, and what failed. */
const notificationLogSchema = new Schema(
  {
    origin: { type: String, enum: ["manual", "system"], default: "system", index: true },
    event: String,
    category: String,
    title: { type: String, required: true },
    body: String,
    link: String,
    audience: { type: { type: String }, labels: [String] },
    channels: { email: Boolean, push: Boolean },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sentByName: String,
    totals: { recipients: Number, inApp: Number, emailSent: Number, emailFailed: Number, emailSkipped: Number, pushSent: Number, pushFailed: Number, pushNoDevice: Number, pushSkipped: Number, externalSent: Number, externalFailed: Number },
    /** Individual failures (capped), so an administrator can see who missed out and retry. */
    failures: [{ channel: String, user: { type: Schema.Types.ObjectId, ref: "User" }, name: String, to: String, error: String, retried: { type: Boolean, default: false } }],
    status: { type: String, enum: ["done", "partial", "failed"], default: "done" },
  },
  opts,
);
// System logs are housekeeping; keep them for 90 days. Manual broadcasts are kept.
notificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400, partialFilterExpression: { origin: "system" } });


/** One record per tab per synchronisation attempt. Kept 180 days. */
const sheetSyncLogSchema = new Schema(
  {
    run: { type: String, index: true },
    tabKey: { type: String, index: true },
    tab: String,
    trigger: { type: String, enum: ["manual", "auto", "retry"], default: "manual" },
    status: { type: String, enum: ["ok", "failed", "skipped"], required: true, index: true },
    rows: Number,
    ms: Number,
    error: String,
    note: String,
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: String,
  },
  opts,
);
sheetSyncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });

/** Every AI request: who asked, which read-only tools ran, and what came back. Kept 180 days for accountability. */
const aiLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userName: String,
    role: String,
    kind: { type: String, enum: ["ask", "draft"], required: true },
    question: String,
    answer: String,
    tools: [{ name: String, args: String, ms: Number, error: String }],
    model: String,
    tokensIn: Number,
    tokensOut: Number,
    ms: Number,
    error: String,
  },
  opts,
);
aiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });

// ---------- Leadership, committees, tasks, meetings, documents (section 13) ----------
/** Every governance record belongs to exactly one organisational level, with its full ancestry filled in from the database. */
const orgFields = {
  level: { type: String, enum: ["province", "zone", "area", "parish"], required: true, index: true },
  zone: { type: Schema.Types.ObjectId, ref: "Zone", index: true },
  area: { type: Schema.Types.ObjectId, ref: "Area", index: true },
  parish: { type: Schema.Types.ObjectId, ref: "Parish", index: true },
};
const trail = [{ at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, action: String, note: String }];

/** A person holding a position: provincial/zonal/area/parish leadership, or a department head/officer. */
const appointmentSchema = new Schema(
  {
    ...orgFields,
    position: { type: String, required: true, trim: true },
    member: { type: Schema.Types.ObjectId, ref: "Member", index: true },
    holderName: { type: String, required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    responsibilities: [String],
    startsAt: { type: Date, default: Date.now },
    endsAt: Date,
    status: { type: String, enum: ["active", "ended"], default: "active", index: true },
    endedAt: Date,
    endedReason: String,
    history: trail,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const committeeSchema = new Schema(
  {
    ...orgFields,
    name: { type: String, required: true, trim: true },
    purpose: String,
    responsibilities: [String],
    status: { type: String, enum: ["active", "dissolved"], default: "active", index: true },
    formedAt: { type: Date, default: Date.now },
    dissolvedAt: Date,
    members: [{ member: { type: Schema.Types.ObjectId, ref: "Member" }, name: String, role: { type: String, enum: ["chair", "vice_chair", "secretary", "treasurer", "member"], default: "member" }, since: { type: Date, default: Date.now }, until: Date, active: { type: Boolean, default: true } }],
    history: trail,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const taskSchema = new Schema(
  {
    ...orgFields,
    title: { type: String, required: true, trim: true },
    description: String,
    assignee: { type: Schema.Types.ObjectId, ref: "Member", index: true },
    assigneeName: String,
    committee: { type: Schema.Types.ObjectId, ref: "Committee", index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting", index: true },
    dueAt: { type: Date, index: true },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    status: { type: String, enum: ["open", "in_progress", "done", "cancelled"], default: "open", index: true },
    completedAt: Date,
    updates: [{ at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: "User" }, byName: String, status: String, note: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
  },
  opts,
);

const meetingSchema = new Schema(
  {
    ...orgFields,
    title: { type: String, required: true, trim: true },
    bodyKind: { type: String, enum: ["committee", "department", "leadership", "other"], default: "other" },
    committee: { type: Schema.Types.ObjectId, ref: "Committee", index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    scheduledAt: { type: Date, required: true, index: true },
    venue: String,
    agenda: String,
    status: { type: String, enum: ["scheduled", "held", "cancelled"], default: "scheduled", index: true },
    reminderAt: Date,
    attendance: [{ member: { type: Schema.Types.ObjectId, ref: "Member" }, name: String, status: { type: String, enum: ["present", "absent", "apology"], default: "absent" } }],
    minutes: String,
    minutesBy: String,
    minutesAt: Date,
    decisions: [{ text: String, at: { type: Date, default: Date.now }, byName: String }],
    actions: [{ text: String, assignee: { type: Schema.Types.ObjectId, ref: "Member" }, assigneeName: String, dueAt: Date, task: { type: Schema.Types.ObjectId, ref: "Task" } }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  opts,
);

const documentSchema = new Schema(
  {
    ...orgFields,
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, enum: ["minutes", "policy", "report", "letter", "other"], default: "other" },
    committee: { type: Schema.Types.ObjectId, ref: "Committee", index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    meeting: { type: Schema.Types.ObjectId, ref: "Meeting", index: true },
    media: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    fileName: String,
    mime: String,
    size: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedByName: String,
  },
  opts,
);


/** Short-lived counters for rate limiting (shared across serverless instances). */
const rateLimitSchema = new Schema({ key: { type: String, required: true, unique: true }, count: { type: Number, default: 0 }, expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } } });

/** Server errors with a request id the person can quote. Message and stack only; never request bodies. */
const errorLogSchema = new Schema(
  { requestId: { type: String, index: true }, method: String, path: String, status: Number, message: String, stack: String, user: { type: Schema.Types.ObjectId, ref: "User" }, ip: String },
  opts,
);
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });

/** Audit rows are append-only: the app can never edit or remove them. */
const refuse = (what: string) => function () { throw new Error(`${what} cannot be changed or deleted.`); };
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  auditSchema.pre(op as any, refuse("Audit records"));
}
auditSchema.pre("save", function (this: any, next: any) { if (!this.isNew) throw new Error("Audit records cannot be changed or deleted."); next(); });
/** Financial records are never hard-deleted. Corrections go through history entries. */
for (const op of ["deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  remittanceSchema.pre(op as any, refuse("Financial records"));
  reportSchema.pre(op as any, refuse("Submitted reports"));
}


// ---------- Section 20: relationships, indexes and data-integrity rules ----------
// Rule 6: impossible organisational combinations are refused by the data layer itself.
orgChain(parishSchema, { self: true, requireArea: true });
orgChain(remittanceSchema);
orgChain(reportSchema);
orgChain(memberSchema);
orgChain(registrationSchema);
orgChain(userSchema);
reportSchema.pre("validate", function (this: any) { const bad = reportShapeProblem(this); if (bad) this.invalidate("type", bad); });

// Rule 1: exactly one canonical Youth Sunday obligation per parish per period (index above); one record per parish per levy.
remittanceSchema.index({ parish: 1, levy: 1 }, { unique: true, partialFilterExpression: { levy: { $type: "objectId" } } });
remittanceSchema.index({ parish: 1, contribution: 1 }, { unique: true, partialFilterExpression: { contribution: { $type: "objectId" } } });
// Rule 7: duplicate receipts and references are findable instantly (flagged for a human, never auto-rejected).
remittanceSchema.index({ reference: 1 }, { sparse: true });
remittanceSchema.index({ "payments.reference": 1 }, { sparse: true });
remittanceSchema.index({ evidenceId: 1 }, { sparse: true });
remittanceSchema.index({ "payments.evidenceId": 1 }, { sparse: true });
remittanceSchema.index({ year: -1, month: -1, status: 1 });
remittanceSchema.index({ zone: 1, year: -1, month: -1 });
reportSchema.index({ status: 1, year: -1, month: -1 });
reportSchema.index({ zone: 1, year: -1, month: -1 });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ parish: 1 }, { sparse: true });
memberSchema.index({ parish: 1, status: 1 });
memberSchema.index({ oldPhoneKeys: 1 }, { sparse: true });
registrationSchema.index({ phoneKey: 1 });
registrationSchema.index({ member: 1, event: 1 }, { sparse: true });
attendanceSchema.index({ phoneKey: 1 });
eventSchema.index({ status: 1, startsAt: -1 });
announcementSchema.index({ status: 1, pinned: -1, publishedAt: -1 });
notificationLogSchema.index({ createdAt: -1 });

eventSchema.pre("validate", async function (this: any) {
  if (this.slug) return;
  const base = slugify(this.title || "event");
  for (let n = 0; n < 8; n++) {
    const cand = n === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await this.model("Event").exists({ slug: cand }))) { this.slug = cand; return; }
  }
  this.slug = `${base}-${Date.now().toString(36)}`;
});

// Controlled revisions: a reporting period that has been locked accepts no new submissions.
for (const schema of [remittanceSchema, reportSchema]) {
  schema.pre("validate", async function (this: any) {
    if (this.period || !this.year || !this.month) return;
    const P = this.model("ReportingPeriod");
    const p: any = await P.findOneAndUpdate(
      { key: periodKey(this.year, this.month) },
      { $setOnInsert: { key: periodKey(this.year, this.month), year: this.year, month: this.month, label: periodLabel(this.year, this.month), dueAt: periodDue(this.year, this.month), status: "open" } },
      { upsert: true, new: true },
    );
    if (this.isNew && p.status === "locked") { this.invalidate("month", `${p.label} is locked and accepts no new submissions.`); return; }
    this.period = p._id;
  });
}

// Immutable by design: decisions and confirmed money can never be edited or removed. A mistake is corrected with
// a new, explained record (a manual adjustment), never by changing history.
for (const [schema, what] of [[financialApprovalSchema, "Financial approvals"], [paymentTransactionSchema, "Confirmed payments"]] as const) {
  for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"] as const) schema.pre(op as any, refuse(what));
  (schema as any).pre("save", function (this: any, next: any) { if (!this.isNew) throw new Error(`${what} cannot be changed or deleted.`); next(); });
}
for (const op of ["deleteOne", "deleteMany", "findOneAndDelete"] as const) bankReconciliationSchema.pre(op as any, refuse("Reconciliation records"));
reportingPeriodSchema.pre("deleteOne", refuse("Reporting periods") as any);
reportingPeriodSchema.pre("deleteMany", refuse("Reporting periods") as any);

export const SYNC_COLLECTIONS = ["User", "Zone", "Area", "Parish", "Site", "Media", "Audit", "SystemConfig", "Remittance", "Report", "Event", "Registration", "Member", "AttendanceSession", "Attendance", "Announcement", "Department", "PasswordReset", "PushSub", "Notification", "NotificationLog", "SheetSyncLog", "AiLog", "Appointment", "Committee", "Task", "Meeting", "GovDocument", "Role", "Permission", "ReportingPeriod", "AdditionalLevy", "Contribution", "PaymentTransaction", "FinancialApproval", "BankReconciliationRecord"] as const;
/** Collections that stay on the running database only (not copied to backup databases). */
export const LOCAL_ONLY = ["RateLimit", "ErrorLog"] as const;
export type ModelName = (typeof SYNC_COLLECTIONS)[number] | (typeof LOCAL_ONLY)[number];

const schemas: Record<ModelName, Schema> = {
  User: userSchema,
  Zone: zoneSchema,
  Area: areaSchema,
  Parish: parishSchema,
  Site: siteSchema,
  Media: mediaSchema,
  Audit: auditSchema,
  SystemConfig: systemConfigSchema,
  Remittance: remittanceSchema,
  Report: reportSchema,
  Event: eventSchema,
  Registration: registrationSchema,
  Member: memberSchema,
  AttendanceSession: sessionSchema,
  Attendance: attendanceSchema,
  Announcement: announcementSchema,
  Department: departmentSchema,
  PasswordReset: resetSchema,
  PushSub: pushSchema,
  Notification: notificationSchema,
  NotificationLog: notificationLogSchema,
  SheetSyncLog: sheetSyncLogSchema,
  AiLog: aiLogSchema,
  Appointment: appointmentSchema,
  Committee: committeeSchema,
  Task: taskSchema,
  Meeting: meetingSchema,
  GovDocument: documentSchema,
  Role: roleSchema,
  Permission: permissionSchema,
  ReportingPeriod: reportingPeriodSchema,
  AdditionalLevy: additionalLevySchema,
  Contribution: contributionSchema,
  PaymentTransaction: paymentTransactionSchema,
  FinancialApproval: financialApprovalSchema,
  BankReconciliationRecord: bankReconciliationSchema,
  RateLimit: rateLimitSchema,
  ErrorLog: errorLogSchema,
};

export type Models = { [K in ModelName]: Model<any> };

export function bindModels(conn: Connection): Models {
  const out = {} as Models;
  for (const name of [...SYNC_COLLECTIONS, ...LOCAL_ONLY] as ModelName[]) {
    out[name] = (conn.models[name] as Model<any>) || conn.model(name, schemas[name]);
  }
  return out;
}
