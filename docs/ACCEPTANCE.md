# Section 24: end-to-end acceptance tests

**Honest status.** The application has never been built or run, so no scenario below has been *demonstrated end to end*. What exists:

- **Logic tests (run, passing):** `npm run test:acceptance` runs `tests/acceptance.logic.ts` (11 checks) against the real accounting, status, scoping and contact-visibility code with fixture data. No database needed.
- **Live E2E script (written, never run):** `npm run test:e2e` runs `tests/e2e/acceptance.mjs` over HTTP against a deployed staging instance. It creates "E2E <run id>" records, walks the scenarios below, and prints PASS / FAIL / SKIP. It was written from the route code, so expect a few request-shape corrections on first execution.
- **Manual:** things a script can't prove (installing the PWA, real phone calls, seeing a PDF look right).

SKIP means an integration isn't configured (AI, email, push, Sheets). It is never reported as a pass.

Legend: **L** logic test · **E** E2E script · **M** manual · ✱ also enforced in code by design.

| Scenario | L | E | M | Notes |
|---|---|---|---|---|
| **Organisational structure** 1–5 create zone with areas, standalone zone, parishes under area/zone, assign admins | | ✔ | | `orgChain` plugin rejects a parish whose area is in another zone (E checks it). |
| 6 each administrator sees only permitted records | ✔ (scope clamping) | ✔ | | `recordScope`/`clampScope` ✱. |
| **Parish reporting** 1–3 names + contact in form | | ✔ | ✔ look of the form | Contact is required by the schema on submit. |
| 4–6 offering, 40%, bank details | ✔ (40% of ₦100,000 = ₦40,000) | ✔ | | Percentage and bank details come from settings, not constants. |
| 7 direct payment | | | ✔ | Happens outside the app, by design. |
| 8–9 receipt upload, AI examination | | ✔ (SKIP without `ANTHROPIC_API_KEY`) | ✔ with a real receipt | AI is advisory only. |
| 10–12 report without waiting for finance, contact stored | ✔ (report/payment statuses are independent) | ✔ | | The report route requires the remittance record to exist, **not** to be confirmed. |
| **Area reporting** 1–7 | | ✔ | | Rollup counts only; money is never summed in the area report. |
| **Zonal reporting** 1–7 incl. directly attached parishes | | ✔ | | |
| **Financial verification** 1–9 | ✔ (only a confirmation creates ledger money) | ✔ | ✔ visual | Confirm, flag, notify parish/area/zone, respond with more evidence, history kept, audit rows. Confirmation twice is refused (E). |
| **Accounting accuracy** 1–7 | ✔ all seven | ✔ | | Parish ₦40,000 counted once at parish, area, zone and province; unconfirmed ≠ received; levies separate; partial and outstanding exact. |
| **Contact information** 1–3 stored | | ✔ | | |
| 4 provincial can view | ✔ (`canSeeContact`) | ✔ | | |
| 5 clickable phone numbers | | | ✔ | `tel:` links in the UI. |
| 6 contact in authorised PDF/Excel exports | | ✔ (CSV, XLSX, PDF signatures) | ✔ open the files | |
| 7 historical contact unchanged after account edit | | ✔ | | Report stores its own snapshot; history is append-only. |
| 8 members and public cannot see contacts | ✔ | ✔ | | |
| **Other** 1 events + registration | | ✔ | | |
| 2–3 registration and attendance QR | | ✔ lookup and check-in | ✔ scan with a phone camera | |
| 4 duplicate attendance prevented | | ✔ | | Unique index on session+phone. |
| 5–6 member profile, permissions, history | | ✔ | | |
| 7 notifications where configured | | ✔ (SKIP if not configured) | | |
| 8 Sheets sync without duplicates | | partial | ✔ | The script checks that two syncs succeed; counting rows in the sheet must be done by a person. |
| 9 PDF and Excel exports | | ✔ | ✔ | |
| 10 PWA install | | | ✔ | `docs/PWA-TESTING.md`. |
| 11 offline financial operations never appear confirmed | | ✔ (service worker never touches writes) | ✔ airplane-mode test | |
| 12 audit logs capture sensitive actions | | ✔ | | |

## Running
```
npm run check                 # static repo checks
npm run test:acceptance       # logic scenarios (needs typescript installed)
BASE_URL=https://staging.example ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:e2e
```
Run the E2E script against **staging**. Payments, audit rows and reports are append-only, so test records cannot be deleted afterwards; they are named "E2E …" so they are easy to recognise.
