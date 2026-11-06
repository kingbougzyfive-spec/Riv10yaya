# RCCG Rivers 10 YAYA — Platform (Phase 1)

Phase 1 = foundation + Super Admin CMS: glass UI, PWA, auth/RBAC, org hierarchy
(zones → areas → parishes, incl. standalone zones), multi-URI database failover,
site editor with live preview, media library, users & roles, audit log.

## Run it
```bash
npm install
cp .env.example .env.local     # set APP_SECRET (32+ random chars)
npm run dev                    # http://localhost:3000  → redirects to /setup on first run
```
`/setup` asks for a MongoDB URI (or set `MONGODB_URI` in `.env.local`), then creates the Super Admin.

## Deploy to Vercel
1. Push to GitHub, then import the repo in Vercel (framework: Next.js, nothing else to set).
2. Environment variables: `APP_SECRET` (32+ random chars), `MONGODB_URI` (Atlas), `NEXT_PUBLIC_APP_URL` (your https URL). Optional: `MONGODB_URI_BACKUP_1..3`, `RESEND_API_KEY`, `MAIL_FROM`.
3. Atlas → Network Access: allow `0.0.0.0/0` (Vercel uses changing IPs).
4. Open `/api/health` (should return `ok: true`), then `/setup` to create the Super Admin.
Notes: Vercel's disk is read-only, so databases added in the app are kept (encrypted) in the database itself; keep your main URI in `MONGODB_URI`. Vercel limits request bodies to ~4.5 MB, so image/evidence uploads are capped at 4 MB.

## Multiple MongoDB URIs (Admin → Database)
- Add any number of connection strings; each is tested before saving and stored AES-256-GCM encrypted.
- The starred **Active** DB is used first; if it fails the app moves to the next healthy one by priority,
  and returns to the Active one automatically when it recovers (checked every 60 s).
- A backup only helps if it has your data: use **Copy data here** regularly (upsert, never deletes).
- Env URIs (`MONGODB_URI`, `MONGODB_URI_BACKUP_1..3`) are shown read-only.
- Atlas: add your server's IP under Network Access.
- Hosting without a writable disk (serverless): keep at least `MONGODB_URI` in env; the saved list is mirrored into the DB.

## Site Editor (Admin → Site Editor)
Brand (logo, colours), hero, welcome, about/mission/vision, numbers, leaders, gallery, contact & social, section toggles.
Preview updates as you type (mobile/tablet/desktop; Home/About/Leadership/Gallery/Contact). Nothing goes public until **Publish**.
Images live in the database (≤4 MB, big photos auto-shrunk in the browser), so they follow failover/sync.

## Phase 2: monthly reports & finance (added)
- **Parish flow:** Finance step (offering → live 40% calc → pay into the provincial account → upload private evidence → optional separate levies), then straight on to the activity report; no waiting for approval.
- **Area & zone reports:** identity + parish/area lists and submitted/outstanding counts are filled in from the database (ids are canonical).
- **ADMINISTRATOR'S CONTACT INFORMATION** section in every report form: name, active phone, optional alt phone; validated (Nigerian + international), saved as a snapshot with the report, shown only to authorised admins with tap-to-call links, included in the CSV export.
- Mandatory numbers (e.g. meetings held) reject blanks; 0 must be typed. Text fields require NIL.
- **Finance desk:** bank details and % are editable with history; finance can confirm / reject / request evidence / flag; parish can respond; nobody can approve their own parish; originals are never overwritten; levies are listed separately from the 40%.
- Evidence files are private (parish, finance and provincial staff only).
- Export: CSV for now. PDF/Excel exports come next.

## Phase 3: events, registration & QR attendance (added)
- **Events (Admin → Events):** create/edit, publish/unpublish/cancel, flyer, venue/map, deadline, capacity, eligibility, organisers, contact, custom registration questions, weekly/monthly recurrence.
- **Public registration:** /events → event page → form (zone/area/parish picked from the database) → unique registration ID + reference + QR ticket page. Confirmation email if `RESEND_API_KEY` is set.
- **Registrations:** search, filter by zone/area/parish, check-in, registered-vs-attended counts, Excel-compatible CSV export.
- **QR attendance (Admin → QR Attendance):** sessions at parish/area/zone/province level, open/close window enforced by the server clock, unguessable token in the QR, PNG download, printable poster and sticker sheet (Print → Save as PDF), manual corrections that record who made them, optional location signal, live list, regenerate-QR if a code leaks.
- **Attendee page (/attend/<token>):** member ID or phone, or visitor sign-in. Duplicates blocked by a database unique index.
- **Members (Admin → Members):** member IDs generated automatically, scoped to each admin's zone/area/parish.
- **Reports:** attendance by parish/area/zone/province for a period or event, with trend.

## Phase 4: content & door scanner (added)
- **Announcements** and **Departments** (Admin menu): add/edit, publish or hide, pin, images. Public pages /announcements and /departments; latest announcements appear on the home page.
- **Ticket scanner** (Admin → Events → Registrations → Scan tickets): uses the phone camera (BarcodeDetector, with jsQR fallback), refuses tickets for other events, tells you if someone is already checked in, and has a type-in fallback.

## Phase 5: exports & member portal (added)
- **Exports:** Excel (.xlsx), PDF and CSV for monthly reports and event attendee lists (needs `exceljs` and `pdf-lib`, already in package.json). Contact columns only for authorised roles.
- **Member self sign-up** (/join) creates a plain member account and member ID; **/me** shows the member's own ID/QR, profile, event tickets and attendance. A member can only ever load their own record.

## Phase 6: accounts, Sheets, AI receipts (added)
- **Password reset** (/forgot → emailed one-time link, 1 hour, hashed token) and **change password** (Admin → My account, member portal). Without email configured the page tells users to ask the Super Admin.
- **Admin → Integrations:** honest status of Google Sheets, Email, AI. **Sheets sync** replaces a tab each time (no duplicates): Reports, Finance (Youth Sunday and levies kept as separate rows), Attendance. Needs `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_SHEET_ID`.
- **AI receipt reading** for finance (advisory): extracts amount/date/reference from private evidence and compares with the declared figures; never changes a status. Needs `ANTHROPIC_API_KEY`.

## Home page (updated)
The hero is a slider: slide 1 is the Hero tab in Admin → Site Editor, and **More slides** adds up to 8 more (each with its own photo, text and buttons). Below it, a countdown bar shows the next published event, followed by upcoming events and a join call-to-action. No sample events are created; the home page shows only what you publish under Admin → Events.

## Financial verification and compliance (sections 9.3 to 9.7)
- **Two independent statuses.** Report status (not started, draft, submitted, completed, revision requested, incomplete) and financial verification status (awaiting evidence, receipt uploaded, AI examination completed, awaiting finance verification, confirmed, payment not found, amount mismatch, rejected, resubmission required). A report never waits for payment verification.
- **Finance decisions** (finance admin / super admin only, never on your own parish): begin verification, confirm (amount found, bank reference, remarks, optional attachment), payment not found, amount mismatch, request resubmission, reject. Every decision stores who, when, why, reference and amount, and is append-only.
- **Payment not found** notifies the parish, area and zonal administrators (in-app bell, plus email when configured), asks for more details, lets the parish respond and upload more evidence, keeps the original receipt, and never touches the submitted report.
- **Part payments, overpayments, adjustments.** A remittance can have several payments, each verified separately. Outstanding = required minus confirmed; it is paid only when confirmed money reaches the requirement. Manual adjustments need a reason and are permanent.
- **Compliance** (Admin → Reports → Compliance) is derived from both statuses. Only confirmed money counts as revenue; pending, rejected or unverified evidence never does.
- **Report review**: zonal/area/provincial reviewers can mark a report completed, request a revision or mark it incomplete. Parish administrators can save drafts and revise submitted reports (history kept).

## Light / dark theme (added)
A sun/moon button (website header and admin sidebar) switches themes and remembers the choice per device. Dark is the default. Tailwind's `white` colour is mapped to a theme variable, so existing `text-white/…`, `bg-white/…`, `border-white/…` classes adapt automatically; QR codes and print sheets stay true white.

## Push notifications (added)
Opt-in web push: visitors tap **Turn on notifications** on the Install and Announcements pages. Publishing an announcement notifies subscribed devices (untick per announcement). Super admins can send a test from Admin → Integrations. Needs `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`); without them the button is hidden and nothing is sent. iPhones only receive push after the app is installed to the home screen.

## SMS (added)
Termii-based SMS. With `TERMII_API_KEY` set, a text with the reference and ticket link goes to everyone who registers for an event. Super admins can send a test from Admin → Integrations. Without the key nothing is sent.

## Not built yet (next phases)
The remaining part of your spec after section 8.9.

## Provincial financial dashboard (`/admin/finance/dashboard`)
Calculated live from Remittance and Parish records; nothing is hardcoded. Filters: month (or whole year), year, zone, area, parish. Only confirmed money counts as received.
- Cards (all clickable, each opens the underlying records with search and CSV/XLSX/PDF export): expected, confirmed, outstanding, pending verification, flagged, rejected, levies, contributions, partial payments, overpayments, parishes expected / submitted / yet to submit.
- Charts (Recharts): monthly trend, zone comparison, submissions by month, levies and contributions by month.
- Zone, area and parish tables (click a name to filter to it); parishes with no return show "Not submitted".
- Reconciliation tab: declared money split by status that must sum to the declared total; required − confirmed = outstanding − overpaid; bank-confirmed vs declared; adjustments; variance list and payment ledger.
- Levy submissions now carry a category (levy or contribution) so the two are reported apart.
- Scope: zonal, area and parish roles see only their own records; the server ignores any wider filter.
Logic lives in `lib/finance-dash.ts` (pure) and is covered by a fixture test.

## Organisation dashboards (admin home, `/api/overview`)
One dashboard component, four levels, chosen by the signed-in role and drill-down:
- **Parish:** expected remittance, amount paid and confirmed, financial verification status, monthly report status, attendance, previous reports, outstanding requirements (each links to the fix), notifications and contact details.
- **Area:** parishes, reports submitted/outstanding, verification progress bar, confirmed and outstanding remittances, attendance, the area report status and a parish-by-parish table.
- **Zone:** areas, parishes, directly attached parishes, area and parish reports submitted/outstanding, money, zonal activities (zone sessions plus the zonal report), attendance and zonal report status.
- **Province:** all zones with the same measures; click a zone → area → parish.
Access: the server derives the ancestry of any requested id from the database and refuses anything outside the user's assigned zone, area or parish. Money is read once per parish remittance; area, zone and province figures are sums of parishes (never of report roll-ups), so nothing is double counted. Logic: `lib/overview.ts` (pure, tested).
