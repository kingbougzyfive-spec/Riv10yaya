# Handoff: RCCG Rivers 10 YAYA platform

Give this whole folder to a new Claude session and say: "Read docs/HANDOFF.md, then continue: deploy to Vercel and fix the first-build errors."

## State
- Next.js 15 (App Router) + TypeScript + Tailwind, MongoDB via Mongoose, 10 RBAC roles, PWA. Sections 1-25 of the master prompt are implemented.
- **Never built or run.** Only syntax scans, pure-logic tests and repo scripts were run (no npm access in the original sandbox). Expect first-build fixes. `next.config.mjs` currently has `typescript.ignoreBuildErrors: true`; run `npm run typecheck`, fix, then remove it.
- Git history is included (`.git`, 26 commits). Nothing was ever pushed anywhere. Not deployed.
- Standing user instructions: do not push or deploy until the user asks; commit trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: ...`.

## Setup
```
npm install
npm run check            # repo checks
npm run test:acceptance  # logic scenarios
npm run dev
```
- Database: built-in fallback in `lib/db-default.ts` (a live Atlas credential: keep the repo PRIVATE and rotate the password). `MONGODB_URI` overrides it.
- `APP_SECRET`: auto-generated and stored in the database if not set.
- First administrator: open `/setup` right after deploy (locks after the first account). No hardcoded admin password exists, by design.
- Optional env: CRON_SECRET, ANTHROPIC_API_KEY (+ANTHROPIC_MODEL), RESEND_API_KEY, MAIL_FROM, VAPID_*, TERMII_*, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID, SETUP_TOKEN, BOOTSTRAP_ADMIN_*.
- Vercel crons in `vercel.json` (daily only on Hobby).

## Accounts
| Who | Route |
|---|---|
| First super admin | `/setup` |
| Sign in | `/login` |
| Create admins (provincial, finance, auditor, zonal, area, parish, event, department) | `/admin/users` (temp password, forced change at first sign-in) |
| Members self-register | `/join` |
| Password reset | `/forgot-password`, `/reset-password` |
| Own account | `/admin/account` |

Parish admins use `/portal`; members `/member/*`; admins `/admin/*`.

## Key rules
Money is integer kobo. Only CONFIRMED payments count as received. Report status and financial status are separate; a parish report never waits for finance. 40% remittance goes parish -> provincial directly; area/zone reports only roll up. Audit, FinancialApproval and PaymentTransaction are append-only. Every report stores an administrator name and phone snapshot.

## Docs
docs/DATA-MODEL.md, docs/REQUIREMENTS-STATUS.md, docs/ACCEPTANCE.md, docs/PWA-TESTING.md, README.md. Live E2E: `BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:e2e` (staging only).

## Routes
### Pages
- `/`
- `/about`
- `/admin`
- `/admin/account`
- `/admin/ai-assistant`
- `/admin/analytics`
- `/admin/announcements`
- `/admin/attendance`
- `/admin/attendance/[id]`
- `/admin/audit-logs`
- `/admin/committees`
- `/admin/database`
- `/admin/departments`
- `/admin/documents`
- `/admin/events`
- `/admin/events/[id]`
- `/admin/exports`
- `/admin/finance`
- `/admin/integrations`
- `/admin/integrations/sheets`
- `/admin/leadership`
- `/admin/media`
- `/admin/meetings`
- `/admin/members`
- `/admin/notifications`
- `/admin/organizations`
- `/admin/reconciliation`
- `/admin/registrations`
- `/admin/remittances`
- `/admin/reports`
- `/admin/reports/new`
- `/admin/security`
- `/admin/settings`
- `/admin/site`
- `/admin/tasks`
- `/admin/users`
- `/announcements`
- `/attendance/[token]`
- `/contact`
- `/departments`
- `/events`
- `/events/[slug]`
- `/events/[slug]/ticket/[ref]`
- `/forgot-password`
- `/gallery`
- `/install`
- `/join`
- `/leadership`
- `/login`
- `/member`
- `/member/attendance`
- `/member/events`
- `/member/notifications`
- `/member/profile`
- `/portal`
- `/portal/attendance`
- `/portal/history`
- `/portal/monthly-report`
- `/portal/notifications`
- `/portal/payment-evidence`
- `/portal/remittance`
- `/print/attendance/[id]`
- `/register/[eventId]`
- `/reset-password`
- `/setup`
- `/structure`
- `/zones`

### API
- `/api/ai/ask` POST 
- `/api/ai/draft` POST 
- `/api/ai/log` GET 
- `/api/announcements/[id]` PATCH DELETE 
- `/api/announcements` GET POST 
- `/api/attendance/report` GET 
- `/api/attendance/sessions/[id]` GET PATCH POST DELETE 
- `/api/attendance/sessions` GET POST 
- `/api/audit` GET 
- `/api/auth/forgot` POST 
- `/api/auth/login` POST 
- `/api/auth/logout` POST 
- `/api/auth/password` POST 
- `/api/auth/reset` POST 
- `/api/comms/audience` POST 
- `/api/comms/logs/[id]` GET POST 
- `/api/comms/logs` GET 
- `/api/comms/send` POST 
- `/api/comms/settings` GET PUT 
- `/api/compliance` GET 
- `/api/cron/reminders` GET POST 
- `/api/cron/sheets` GET 
- `/api/database` GET POST 
- `/api/departments/[id]` PATCH DELETE 
- `/api/departments` GET POST 
- `/api/events/[id]` PATCH DELETE 
- `/api/events` GET POST 
- `/api/evidence` POST 
- `/api/exports/[type]` GET 
- `/api/finance/dashboard/records` GET 
- `/api/finance/dashboard` GET 
- `/api/finance/ledger` GET POST 
- `/api/finance/obligations` GET POST 
- `/api/finance/reconciliation` GET 
- `/api/finance/settings` GET PUT 
- `/api/governance/appointments/[id]` PATCH 
- `/api/governance/appointments` GET POST 
- `/api/governance/committees/[id]` GET PATCH 
- `/api/governance/committees` GET POST 
- `/api/governance/departments/[id]` PATCH 
- `/api/governance/departments` GET POST 
- `/api/governance/documents/[id]` DELETE 
- `/api/governance/documents` GET POST 
- `/api/governance/meetings/[id]` GET PATCH 
- `/api/governance/meetings` GET POST 
- `/api/governance/tasks/[id]` PATCH 
- `/api/governance/tasks` GET POST 
- `/api/health` 
- `/api/integrations/push` POST 
- `/api/integrations/sheets/logs` GET 
- `/api/integrations/sheets` GET PUT POST 
- `/api/integrations/sms` POST 
- `/api/integrations` GET 
- `/api/me/prefs` GET PATCH DELETE 
- `/api/me/register` POST GET 
- `/api/me` GET PATCH 
- `/api/media/[id]` GET DELETE 
- `/api/media` GET POST 
- `/api/members/[id]` GET PATCH 
- `/api/members/categories` GET PUT 
- `/api/members` GET POST 
- `/api/notifications` GET PATCH 
- `/api/org` GET POST PATCH DELETE 
- `/api/overview` GET 
- `/api/periods` GET PATCH 
- `/api/public/announcements` GET 
- `/api/public/attend/[token]` GET POST 
- `/api/public/departments` GET 
- `/api/public/events/[id]/register` POST 
- `/api/public/events/[id]` GET 
- `/api/public/events` GET 
- `/api/public/join` POST 
- `/api/public/org` GET 
- `/api/public/push` GET POST DELETE 
- `/api/public/registrations/[ref]` GET 
- `/api/registrations/[id]` PATCH 
- `/api/registrations/checkin` POST 
- `/api/registrations` GET 
- `/api/remittances/[id]/analyze` POST 
- `/api/remittances/[id]/payments` POST 
- `/api/remittances/[id]` PATCH 
- `/api/remittances` GET POST 
- `/api/reports/[id]/review` POST 
- `/api/reports/[id]` PATCH 
- `/api/reports/context` GET 
- `/api/reports/export` GET 
- `/api/reports/summary` GET 
- `/api/reports` GET POST PUT 
- `/api/security/backup` GET 
- `/api/security/rbac` GET POST 
- `/api/security` GET 
- `/api/seed` POST DELETE 
- `/api/setup` GET POST 
- `/api/site` GET PUT 
- `/api/users` GET POST PATCH 
