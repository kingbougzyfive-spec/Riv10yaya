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

## Light / dark theme (added)
A sun/moon button (website header and admin sidebar) switches themes and remembers the choice per device. Dark is the default. Tailwind's `white` colour is mapped to a theme variable, so existing `text-white/…`, `bg-white/…`, `border-white/…` classes adapt automatically; QR codes and print sheets stay true white.

## Push notifications (added)
Opt-in web push: visitors tap **Turn on notifications** on the Install and Announcements pages. Publishing an announcement notifies subscribed devices (untick per announcement). Super admins can send a test from Admin → Integrations. Needs `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`); without them the button is hidden and nothing is sent. iPhones only receive push after the app is installed to the home screen.

## Not built yet (next phases)
SMS, and the remaining part of your spec after section 8.9.
