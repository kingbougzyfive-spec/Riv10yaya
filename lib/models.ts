import { Schema, type Connection, type Model } from "mongoose";

import { ROLES } from "./roles";
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
    prefs: { email: { type: Boolean, default: true }, sms: { type: Boolean, default: true }, push: { type: Boolean, default: true } },
    lastLoginAt: Date,
  },
  opts,
);

const zoneSchema = new Schema(
  {
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
  },
  opts,
);

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: { type: String, required: true, index: true },
    target: String,
    detail: Schema.Types.Mixed,
    ip: String,
  },
  opts,
);

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
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, default: Date.now },
  },
  opts,
);
reportSchema.index({ type: 1, zone: 1, area: 1, parish: 1, month: 1, year: 1 }, { unique: true });

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
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
    zone: { type: Schema.Types.ObjectId, ref: "Zone", required: true, index: true },
    area: { type: Schema.Types.ObjectId, ref: "Area", default: null, index: true },
    parish: { type: Schema.Types.ObjectId, ref: "Parish", required: true, index: true },
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
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    headName: String,
    imageId: { type: Schema.Types.ObjectId, ref: "Media" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
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
  },
  opts,
);
notificationSchema.index({ user: 1, createdAt: -1 });

export const SYNC_COLLECTIONS = ["User", "Zone", "Area", "Parish", "Site", "Media", "Audit", "SystemConfig", "Remittance", "Report", "Event", "Registration", "Member", "AttendanceSession", "Attendance", "Announcement", "Department", "PasswordReset", "PushSub", "Notification"] as const;
export type ModelName = (typeof SYNC_COLLECTIONS)[number];

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
};

export type Models = { [K in ModelName]: Model<any> };

export function bindModels(conn: Connection): Models {
  const out = {} as Models;
  for (const name of SYNC_COLLECTIONS) {
    out[name] = (conn.models[name] as Model<any>) || conn.model(name, schemas[name]);
  }
  return out;
}
