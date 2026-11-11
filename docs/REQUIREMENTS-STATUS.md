# Section 23 requirements: where each one lives, and how far it is verified

**Read this first.** Nothing here has been built with `next build` or run against a real database. The sandbox has no npm registry access. What has been checked: TypeScript syntax scans, the pure-logic tests, and the repo scripts (`check-pwa`, `check-models`, `check-routes`, `check-env`, `check-ui`, `tests/sw.test.mjs`). Expect a first-build fix pass.

| Requirement | Where | State |
|---|---|---|
| Working authentication | `lib/auth.ts`, `app/api/auth/*`, `middleware.ts`, `/setup` | Written. Env-only bootstrap admin, forced password change, session versioning. Unrun. |
| Database connections | `lib/db.ts` (Atlas, multi-connection failover) | Written. Needs `MONGODB_URI`. Unrun. |
| CRUD | `app/api/*`, `components/admin/*Manager.tsx` | Written for organisations, users, members, events, content, departments, committees, tasks, meetings, documents. |
| Server-side permission checks | `requireApiUser` / `requirePageUser`, `lib/rbac.ts` | Every route checks; the UI only hides things. |
| Report forms | `components/admin/ReportWizard.tsx`, `lib/report-config.ts` | Written. |
| 40% calculation | `lib/finance.ts`, `lib/ledger-core.ts` | Integer kobo; pure tests pass. Percentage editable by provincial admin only. |
| Payment evidence upload | `/api/remittances/*`, `lib/media` | Written. No antivirus scan. |
| AI/OCR examination | `lib/ai-receipt.ts`, `/api/remittances/[id]/analyze` | Needs `ANTHROPIC_API_KEY`. **Without it the Finance Desk says so and hides the button**; it never fakes a reading. Advisory only. |
| Human financial approval | `FinancialApproval` (append-only), Finance Desk | Confirm / mismatch / not found / reject all ask for confirmation. A confirmation cannot be reversed in the app, only adjusted. |
| Separate report and financial status | `lib/verification.ts`, `lib/status.ts`, `StatusBadge` | Two independent statuses plus compliance. |
| Admin contact in every report | `Report` snapshot of submitter name/phone/email | Written. |
| Hierarchy and consolidation | `lib/org-chain.ts`, dashboards | Zones may be standalone; areas optional. |
| Event registration, QR attendance | `/events/[slug]`, `/attendance/[token]`, `SessionDetail` | Written. QR + optional location check; manual adds are flagged. |
| Member self-service | `/member/*` | Written. |
| Notifications | In-app, Web Push, Email (Resend) | In-app always works. **Email and Push are switched off in the compose screen when not configured**, and nothing is sent through them. |
| Google Sheets sync | `lib/sheets.ts`, `lib/sheet-sync.ts`, daily cron | Needs service account env vars; Integrations page shows status. |
| PDF / Excel export | `ExportCenter`, `pdf-lib`, `ExcelJS` | Written. |
| PWA | `public/sw.js`, manifest, `docs/PWA-TESTING.md` | Service worker tested in Node; device testing still required. |
| Audit logging | `lib/api.ts` `audit`, append-only `Audit` | Written. |
| Loading / empty / error / success states | `DataTable`, `EmptyState`, `ErrorState`, toasts | Shared components used by the main tables; older screens still use their own simpler states. |
| Sample data distinct from real | `isSample` flag, `SampleBanner`, `DELETE /api/seed` | Sample rows are flagged and named "Sample …". Super admin sees a banner and can remove them. Removal refuses if real records link to them. |
| No hardcoded financial data / fake confirmations | `scripts/check-ui.mjs` | Script fails on hardcoded ₦ amounts. Only CONFIRMED payments count as received. |
| No decorative buttons | `scripts/check-ui.mjs` | Script catches empty handlers and `href="#"`. It cannot prove every button is wired; that needs a click-through on a real build. |

## Design (section 22) changes
- Calmer surfaces: solid panels, thin borders, no hover lift, no floating orbs, solid brand buttons. Motion is limited to short fades and respects reduced-motion.
- Text contrast floor raised (`text-white/65` minimum, enforced by `check-ui`). Visible focus rings; skip link and `#content` target.
- Admin sidebar grouped: Overview, People & Structure, Events, Reports & Finance, Governance, Communications, System.
- `DataTable` (search, sort, pagination, filter slot, phone card layout) now backs Remittances, Reconciliation, Registrations, QR attendance and the Reports compliance table. Other tables are unchanged.
- `useConfirm()` / `useTextPrompt()` replace every native `confirm`/`prompt`.
- Not done: a full visual QA at real device sizes. Contrast ratios were raised by rule, not measured.
