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

## Members and church CRM (`/admin/members`, `/me`)
- **Record:** unique member ID, name, phone, email, parish → area → zone (always set together from the parish), category (managed list), status, date joined, departments, leadership, event registrations and attendance (matched by member id or any phone number they have had), volunteer history and private follow-up.
- **Admin screen:** filter by zone/area/parish/category/status/department/age/leaders, search, pages, CSV/XLSX/PDF export (audited), add and edit members, transfer to another parish (both ends must be in your scope), category manager (Super/Provincial admin), per-member History, Volunteer, Follow-up and Changes tabs.
- **Change log:** name, phone, email, date of birth, gender, category, status, parish/area/zone, joined date, leadership, departments and guardian changes are appended with who, when, old and new value, and an optional reason. Members' own edits are logged too.
- **Privacy:** records outside your zone/area/parish return "not found". Members under 18 are opened in full only by their Parish Administrator (or the Super Administrator; each opening is audit-logged); everyone else sees name, parish, category and status only, and exports show "(protected)". Under-18 registration needs guardian details and consent; self sign-ups stay unverified until the parish administrator confirms, and cannot register for events until then. Follow-up and the change log are never shown to members.
- **Member portal:** own profile (name, email, phone with password re-entry), category/status/departments, attendance and event history, volunteer service, notifications and email/SMS/push preferences, and registration for open events using their own details. There is no member-id parameter anywhere, so another member's profile cannot be requested.
- **Sign-up safety:** a phone number that already belongs to a member added by a parish can only be linked with the member ID the parish gave them; sign-up needs date of birth and agreement to the privacy notice.

## Leadership, departments and committees (`/admin/governance`)
Tabs: Leadership, Departments, Committees, Tasks, Meetings, Documents.
- **Organisational level:** every record has a level (province, zone, area or parish) and its full ancestry (parish → area → zone) is read from the database, never trusted from the browser. Members placed in a position, committee, task or meeting must belong to that level.
- **Who can do what:** administrators see their own level and everything below it, and can create or change records at their own level and below (zonal admin: the zone, its areas and parishes; area admin: the area and its parishes; parish admin: the parish). Province-level records are for Super and Provincial admins. The Read-only Auditor can view. Rules live in `lib/governance.ts` and are covered by a test.
- **Leadership:** assign positions (suggested titles per level, free text allowed) to a member or a named outsider, with responsibilities, term, history and an "end appointment" step. A member's leadership title in the CRM follows their appointment.
- **Departments:** create zone/area/parish departments with responsibilities; provincial departments still feed the public Departments page. Department heads are appointments; members are assigned on their member record.
- **Committees:** purpose, responsibilities, members with roles (one chair, secretary, treasurer and vice chair at a time), removal with history, dissolve.
- **Tasks:** assign to a member, deadline, priority, progress notes, reassign, overdue tracking and completion rate; assignees with an account are notified.
- **Meetings:** schedule for a committee, department or level; attendance (pre-filled from committee members, opens once the meeting starts), minutes, decisions and action points. An action point becomes a tracked task.
- **Documents:** PDF, Word, Excel, PowerPoint, text, PNG or JPG up to 6 MB, tied to a level, committee or meeting. File contents are checked against their type, stored privately, and served only to administrators of that level or above (not by link sharing).

## Notifications and communication

Every notification goes through one pipeline (`lib/notifier.ts` → `dispatch`): an in-app notice is always created, then email and Web Push follow each person's own settings. Every send writes a delivery log with per-channel totals and a failure list; failed email/push can be retried from **Communications → Delivery log**.

- **Categories**: reports and payments are *locked* (can't be muted, but the global email/push switches still apply). Announcements, events, tasks and general can be muted by each user in **Account** / **My page**.
- **Push** permission is only requested when the user taps the enable button.
- **Sending** (`/admin/communications`): everyone (provincial only), zones, areas, parishes, departments, event registrants, selected members. Each target is checked against the sender's scope; a dry run shows the head-count first. Under-18s are never bulk-emailed.
- **Automatic reminders** run daily at 06:00 UTC (07:00 Lagos) via `vercel.json` → `/api/cron/reminders`. Set `CRON_SECRET` (Vercel sends it as a bearer token). Re-running the same day never duplicates notices. Configure deadline day, lead days, event/meeting windows and the outstanding-remittance interval on the Reminders tab.
- **Assumption**: a report for month M is due on day N (default 10) of month M+1.
- Vercel Hobby allows daily cron only. Needed env: `CRON_SECRET`, `VAPID_*` (push), `RESEND_API_KEY` + `MAIL_FROM` (email).

## Google Sheets integration

Admin → Integrations → **Google Sheets** (`/admin/integrations/sheets`). MongoDB stays the source of truth; the spreadsheet is a **one-way, read-only copy**. Nothing in the code reads cells back, so edits in the sheet can never change a record, and approved financial records are never written from Sheets.

- **Setup:** create a Google service account, enable the Sheets API, set `GOOGLE_SERVICE_ACCOUNT_JSON`, share the spreadsheet with the service account email as Editor (give everyone else Viewer), then paste the spreadsheet link on the settings page (or set `GOOGLE_SHEET_ID`). The connection is verified before any data is built; if the account can't open the sheet, nothing is sent.
- **14 tabs:** Master Parish Register, Monthly Parish Submissions, Confirmed Payments, Outstanding Payments, Pending Verification, Additional Levies, Additional Contributions, Parish Attendance, Area / Zonal / Provincial Summary, Event Registrations, Event Attendance, Monthly Activity Reports. Each can be switched off or renamed. A "Sync Info" tab explains the copy.
- **No duplicates, idempotent:** column A is the database ID; each sync replaces a whole tab with the current snapshot, so repeats and retries can't add rows. Unchanged tabs are skipped (content hash). Rows are written as RAW text, so nothing is evaluated as a formula.
- **Money:** "Confirmed" lists only finance-confirmed payments plus audited adjustments. Pending, needs-action and rejected payments are in Pending Verification and never counted as received. Levies, contributions and Youth Sunday money are separate. Summaries use the same rules as the finance dashboard.
- **Privacy:** no phone/email of members or registrants is sent; under-18 registrant names are withheld.
- **Logs and retry:** every attempt per tab is logged (kept 180 days) with errors; failed tabs show their error and can be retried individually or all at once. Transient Google errors (rate limits, outages) are retried automatically within a run.
- **Who:** super and provincial admins configure and sync everything; finance admins can sync only the finance tabs. Actions are audited.
- **Automatic:** switch on "Sync automatically" for a daily run (`/api/cron/sheets`, 05:30 UTC) that also retries failures. Needs `CRON_SECRET`. A manual sync is limited to one run at a time.
- The old three-tab sync was replaced by this one.

## AI assistant and intelligent reporting

Admin → **AI Assistant** (`/admin/assistant`). Needs `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`); without it the page says so and everything else works.

- **Ask:** answers questions about records using nine read-only tools (submission status and rates by zone/area, finance summary, confirmed-during-month, outstanding remittances, possible duplicate references, incomplete reports, activity-report summary, attendance comparison, parishes needing follow-up). The model never touches the database: tools run on the server, and every query is cut to the signed-in person's scope (`recordScope`) before anything is returned. A zone or area the person can't see simply isn't found.
- **Accuracy:** all figures are computed by the same rules as the dashboards (only CONFIRMED money is "received"; pending, needs-action and rejected are always separate). Each answer shows chips with the data used, the reporting period and the scope, built by the server, not written by the model. "Confirmed this month" is answered both ways (confirmed by finance during the month vs. for that month's reporting period).
- **Safety:** there is no tool that creates, edits, approves, rejects or sends anything, so the assistant cannot approve payments, change obligations or override a decision; it points people to the Finance Desk, Reports or Communications instead. Duplicate-reference results are worded as prompts for a human check, never accusations (a notice is added if the answer drifts). Report excerpts are passed as untrusted data. Member records and contact details are never available to it.
- **Write:** drafts announcements, invitations, meeting notices, reminders, administrative messages and report summaries (from real report data). It never invents dates, venues or amounts (it leaves `[placeholders]`, which the page highlights). "Use in Communications" hands the draft to the Communications page, where a person chooses the audience and sends.
- **Accountability:** every request is logged (who, the question, the tools used, the answer; kept 180 days). Provincial admins see everyone's history; others see their own. Limited to 40 requests per person per hour.
- **Housekeeping:** route files now export only HTTP handlers (Next.js requirement); shared helpers moved to `lib/gov-shape.ts`, `lib/comms-shape.ts`, `lib/ai-limits.ts`.

## Analytics and report exports

Admin → **Reports & Exports** (`/admin/exports`). One endpoint, `GET /api/exports/[type]`, builds every official report; without `format` it returns a preview so filters can be checked before downloading.

- **Reports:** parish / area / zonal monthly reports, provincial consolidated, financial reconciliation, confirmed payments, outstanding payments, attendance, event registrations, members, leadership.
- **Formats:** PDF (letterhead, meta panel, key figures, wrapped tables, repeating headers, page X of Y, confidential footer), Excel (one styled sheet per table, ₦ number formats, frozen headers, filters, print set-up with repeating header rows and page-number footers) and CSV (plain data, formula-looking text neutralised). Long narrative sections (activity answers) are PDF; the full answers grid is Excel.
- **Every export states:** organisation, reporting period, date generated (Lagos), prepared by (name and role), records covered, filters applied, and financial verification status. Monthly reports include each report's administrator name and phone **only for roles allowed to see contacts** (provincial, finance, zonal, area; parish admins for their own parish). Other roles get the report without them.
- **Money:** confirmed (finance-verified) is kept apart from pending, needs-action and rejected. Reconciliation shows four arithmetic checks and any variance records.
- **Confidentiality:** each report type checks the caller's role; every query is cut to their scope and a zone/area/parish filter can only narrow it (`clampScope`; this also closed a gap where the members and registrations lists let a scoped admin widen their view by passing another id). Under-18 members' contact details are protected as on screen. Registration and member exports are marked confidential. Every download is audited.
- The older on-screen export buttons (reports, members, registrations, finance records) now use the same official layout.
- Excel needs `exceljs` and PDF needs `pdf-lib` (both already in `package.json`).

## Installing the app (PWA)
The site is an installable Progressive Web App: manifest, standalone display, theme colour, icons (including a maskable icon), Apple touch icon, iOS/iPadOS launch screens (38 sizes, `public/splash`, regenerate with `python3 scripts/gen-splash.py`), and a service worker. `/install` shows step-by-step instructions and highlights the visitor's own device.
- **Android / desktop (Chrome, Edge):** an "Install now" button appears, or use the browser menu. **iPhone / iPad:** Safari → Share → Add to Home Screen. Firefox on a computer cannot install web apps.
- **Offline behaviour (deliberately narrow).** The service worker (`public/sw.js`) keeps the app shell and a copy of public pages and public read-only data you have already opened (home, events, announcements, departments, zones, leadership, gallery, contact, join, install). It **never** handles a write, and never stores `/admin`, `/me`, `/login`, private files or any financial or personal API. Offline, pages that can't be served show an offline page.
- **Money is never "pending offline".** Every write (`lib/fetcher.ts`) is refused up front when the browser is offline and a network failure is reported as "nothing was confirmed". Success is shown only after a real 2xx server response. Payments, remittances, reports and approvals therefore always need a live connection, and their buttons dim while offline. A banner says so.
- **Safe outbox.** `lib/outbox.ts` queues exactly one kind of action, marking your own notifications read, and shows it as "not sent yet". Anything else is refused by an allowlist. It's cleared on sign-out along with cached pages.
- **Updates** are offered with an "Update" button (never forced mid-form).
- **Push on iPhone/iPad** works only from the installed Home Screen app on iOS/iPadOS 16.4+, after the person taps "Turn on notifications". Background behaviour is not identical across Android, iOS and desktop, and the app says so.
- Checks: `node scripts/check-pwa.mjs` (static) and `node tests/sw.test.mjs` (service worker rules in a sandbox). **Real-device installation has not been tested yet**; follow `docs/PWA-TESTING.md` after deploying.

## Security, privacy and audit
- **Sign-in:** bcrypt hashes (cost 11), signed 12-hour HttpOnly cookie (Secure, SameSite=Lax), a per-user `sessionVersion` so password change/reset, role or scope change and deactivation end older sessions. Failed sign-ins are rate limited per email+address and per address, counted in the database (so it holds on serverless), and equal-time for unknown emails. One password policy everywhere (10+ chars, letter and number, no common or email-based passwords).
- **Authorization:** every route re-checks role and organisational scope on the server; scoped admins cannot widen scope with query parameters; the member portal exposes only the signed-in member's record.
- **CSRF / XSS / headers:** `middleware.ts` rejects cross-site writes to `/api` (Origin / Sec-Fetch-Site) on top of SameSite cookies; CSP (no third-party sources, no framing, no plugins; scripts need `'unsafe-inline'` for Next hydration, a nonce policy is a later step), HSTS, `X-Frame-Options: DENY`, COOP, `nosniff`, Permissions-Policy, and `no-store` on `/api`, `/admin` and `/me`. Input is validated with zod everywhere; Mongoose queries never interpolate raw strings (search regexes are escaped).
- **Rate limits:** a blanket 150 writes/min per address in `handle()`, plus tighter ones on sign-in, reset, setup, public forms, uploads, exports and password changes.
- **Files:** uploads are identified by magic bytes, not the browser's claim; SVG is refused; size limits; stored in the database with a SHA-256; payment evidence is private, permanent and cannot be deleted from the app.
- **Audit trail (`/admin/audit`, Super Admin and Auditor, read only).** Append-only: the Audit model refuses update/delete in code. Each row has actor id, name, email and role, action, record (label, entity, id), before and after, reason, time, address and device. Secret-looking fields are blanked before saving. Covered: sign-in, failed and blocked sign-ins, sign-out, password change/reset, user creation, role / scope / contact / active changes, organisation changes (with before and after), finance settings, receipt uploads, remittance submission and every payment decision, report submit and revise, member edits (including self-edits), exports and downloads, audit CSV exports, backups, Google Sheets syncs (manual and scheduled), uploads and deletions of site images. Filter by area, person, text and date; download CSV.
- **Financial records are never silently removed.** Remittances and submitted reports refuse deletion at the model level; corrections are history entries with a reason; payment evidence and governance documents can't be deleted through the media route.
- **Errors:** server errors are logged (message and short stack, never request bodies) for 90 days and the person sees a reference such as `(ref 3f9a1c2e)`. **Admin → Security** (Super Admin) shows a deployment checklist (never any secret value), recent errors, and a data-copy download.
- **Backups:** turn on MongoDB Atlas backups (Cloud Backup snapshots, or continuous backup with point-in-time restore on paid tiers) and link a backup database under Admin → Database. The Security page's `.jsonl.gz` copy is a convenience for small installs: it leaves out passwords, tokens and file bytes and may be refused on large data. Test a restore before relying on any backup.
- **First administrator and credentials.** Either use `/setup` (protect it with `SETUP_TOKEN`) or set `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` as **server** environment variables. The bootstrap account is created once, only when the database has no users, hashed, flagged "must change password", and blocked from everything except the change-password screen until replaced. Passwords an administrator sets for other people are also temporary in this way. **Before production:** sign in, replace the temporary password, then delete both settings and redeploy; `node scripts/check-env.mjs` and the Security page flag leftovers. Credentials are never in front-end code (nothing uses a `NEXT_PUBLIC_` prefix).
- **Not done / for later:** two-factor sign-in, a nonce-based CSP, antivirus scanning of uploads, and encryption of stored member data beyond what MongoDB Atlas provides at rest.

## Data model and routes (sections 20 and 21)
- **Data model:** see `docs/DATA-MODEL.md`. New: `ReportingPeriod`, `Role`, `Permission`, `AdditionalLevy`, `Contribution`, and the finance trio `PaymentTransaction` (confirmed money only), `FinancialApproval` (every decision) and `BankReconciliationRecord`. The organisation chain, one-obligation-per-period, one-confirmation-per-payment and one-confirmation-per-bank-reference rules are enforced by schemas and unique indexes. Run `node scripts/check-models.mjs`.
- **Routes:** public (`/`, `/about`, `/leadership`, `/structure`, `/zones`, `/events`, `/events/[slug]`, `/register/[eventId]`, `/announcements`, `/gallery`, `/contact`, `/install`), auth (`/login`, `/forgot-password`, `/reset-password`), member (`/member`, `/member/profile|events|attendance|notifications`), parish portal (`/portal`, `/portal/remittance|payment-evidence|monthly-report|attendance|history|notifications`), administration (`/admin/...` as specified), and QR attendance (`/attendance/[token]`). Older addresses (`/me`, `/forgot`, `/reset`, `/attend/...`, `/admin/organization`, `/admin/assistant`, `/admin/communications`, `/admin/audit`, `/admin/finance/dashboard`, `/admin/governance`) redirect, so printed QR codes and sent e-mails keep working. Run `node scripts/check-routes.mjs`.
- Parish administrators land in `/portal`; area and zonal administrators use `/admin` with data limited to their own scope on the server.

## UI system and requirements status
Shared components live in `components/ui` (`DataTable`, `StatusBadge`, `ConfirmDialog` via `useConfirm`/`useTextPrompt`, `EmptyState`, `Field`). Pure logic is in `lib/table.ts` and `lib/status.ts`. `node scripts/check-ui.mjs` enforces no native dialogs, a contrast floor and no hardcoded money. `docs/REQUIREMENTS-STATUS.md` lists each requirement honestly, including what is unverified.

## Zero-configuration deployment (what is built in, and the risks)
- **Database:** `lib/db-default.ts` holds a built-in MongoDB connection string used only when `MONGODB_URI` is not set. It is a live credential in source code: keep the GitHub repository **private**, and rotate the Atlas password if the code is ever shared. Setting `MONGODB_URI` overrides it.
- **Session secret:** if `APP_SECRET` is not set, a random one is generated once and stored in the database (`lib/secret.ts`).
- **App address:** falls back to Vercel's own host variables.
- **First administrator:** with no `BOOTSTRAP_ADMIN_*`/`SETUP_TOKEN`, the `/setup` page is open until the first account exists. Open it yourself immediately after the first deploy.
- Still optional but needed for their features: `CRON_SECRET` (daily reminders, Sheets sync), `ANTHROPIC_API_KEY` (AI receipt reading), `RESEND_API_KEY`, VAPID keys, Google credentials.
