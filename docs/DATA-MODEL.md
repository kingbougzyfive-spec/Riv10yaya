# Data model

MongoDB through Mongoose (no Prisma). Schemas live in `lib/models.ts` and `lib/schemas-extra.ts`; `lib/model-map.ts` maps each model named in the specification to its collection. `node scripts/check-models.mjs` verifies the map and the key rules.

## Hierarchy
```
Province ─┬─ Zone (hasAreas: true)  ── Area ── Parish
          └─ Zone (hasAreas: false) ───────── Parish        (standalone zone: parishes directly under it)
```
A parish stores `zone` always and `area` only when its zone has areas. `lib/org-chain.ts` is a Mongoose plugin on Parish, Remittance, Report, Member, Registration and User: it refuses an area from another zone, a parish from another zone or area, an area under a standalone zone, and a parish without an area in a zone that has areas. It runs on create and whenever zone, area or parish change, so it holds for every route and script.

## Collections
| Specification | Collection | Notes |
|---|---|---|
| User, Role, Permission | `User`, `Role`, `Permission` | Role and Permission rows are a catalogue kept in step with `lib/rbac.ts` (`POST /api/security/rbac`). Access is enforced by code, never by these rows. |
| Zone, Area, Parish | same | unique name per parent (`nameKey`); parish `transfers[]` history |
| Member | `Member` | unique `memberId` and `phoneKey`; `changes[]` append-only |
| Event, EventRegistration | `Event`, `Registration` | event `slug` (unique, generated); one registration per phone per event |
| AttendanceSession, AttendanceRecord | `AttendanceSession`, `Attendance` | one record per session per phone |
| ReportingPeriod | `ReportingPeriod` | one row per month (`key` "2026-10"), due 10th of next month, status open / closed / locked. Remittances and reports link to it automatically. |
| RemittanceSubmission | `Remittance` (kind `yst`) | the canonical obligation; extra payments are appended to `payments[]` |
| PaymentEvidence | `Media` (`private: true`) | SHA-256 stored and indexed for duplicate detection |
| PaymentTransaction | `PaymentTransaction` | **confirmed money only**, immutable ledger |
| AdditionalLevy, Contribution | `AdditionalLevy`, `Contribution` | definitions; payments are `Remittance` rows (kind `levy`) pointing at them |
| MonthlyActivityReport | `Report` | separate from finance; contact snapshot inside |
| FinancialApproval | `FinancialApproval` | every finance decision, immutable |
| BankReconciliationRecord | `BankReconciliationRecord` | latest bank-matching state of each payment |
| Notification, EmailLog | `Notification`, `NotificationLog` | one delivery log covers e-mail, push and in-app |
| Announcement, Department | same | |
| Leadership | `Appointment` | positions with history |
| Committee, CommitteeMember | `Committee` | members embedded (role, dates), indexed by member |
| Task, Meeting | same | |
| Document | `GovDocument` | metadata; the file is a private `Media` record |
| AuditLog | `Audit` | append-only |
| GoogleSheetSyncLog, SystemSettings | `SheetSyncLog`, `SystemConfig` | |

## The ten rules, and where each is enforced
1. **One obligation per parish per period** — unique index on `Remittance {parish, month, year}` for kind `yst`; one record per parish per levy / contribution (`{parish, levy}`, `{parish, contribution}`).
2. **Controlled revisions** — a `Report` is unique per level, place and period; changes append to `history[]` and `revision`. Remittance changes append to `history[]` (never overwritten). A **locked** period refuses new submissions.
3. **Reports separate from finance** — `Report` and `Remittance` are different collections, joined only by an optional reference; a missing payment never blocks a report.
4. **Contact snapshot** — `Report.contact` is copied at submission, and each revision's earlier version is kept in `history[]`.
5. **Separate parish / area / zone reports** — `Report.type` plus `reportShapeProblem` (a parish report names a parish; an area report an area and no parish; a zone report neither).
6. **Correct relationships** — `orgChain` plugin (above).
7. **No duplicate payments or receipts** — a payment can be confirmed once (`PaymentTransaction {remittance, paymentKey}` unique) and a bank reference can be confirmed once (unique `bankReference`); receipt hash and reference are indexed on `Media`, `Remittance` and `payments[]`, and the submission checks flag repeats for a person to look at. Submissions are not hard-rejected on a repeated reference because a genuine resubmission after a rejection legitimately repeats it.
8. **Verification history preserved** — `FinancialApproval` rows and `Remittance.history[]`; both refuse update and delete in code.
9. **Stable ids for Sheets** — `_id` plus the human references (`TXN-…`, `LEV-…`, `RPT-…`, registration `reference`, `memberId`).
10. **Confirmed vs unverified** — a payment becomes money only through a finance decision that writes a `PaymentTransaction`. Evidence and declared amounts stay on the `Remittance`. `GET /api/finance/ledger` compares the two and reports any difference; `POST` repairs rows missing from before the ledger existed.

## Transactions
`lib/tx.ts` `withTx` runs a finance decision (ledger row, approval, reconciliation, remittance change) in one MongoDB transaction (Atlas and any replica set). On a standalone local server, where transactions don't exist, it runs without one; the ledger row with its unique keys is written first, so a duplicate is refused before anything else is saved, and the writes are idempotent so a repeat doesn't double count.

## Honest notes
- Existing embedded designs were kept (payments, history, committee members) rather than split into more collections, because they work and splitting them would risk the finance code. The map above says exactly where each specified model lives.
- Nothing here has been run against a real database yet; the rules are unit-tested as pure functions and the schema files are syntax-checked.
- A confirmation cannot be reversed in the app. A mistake is corrected with a manual adjustment that carries a reason.
