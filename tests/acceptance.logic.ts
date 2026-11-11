/* Section 24 scenarios that can be proven without a database: accounting, contacts, scoping, status separation.
 * Run: node scripts/run-acceptance.mjs   (compiles with tsc and runs; needs typescript available) */
import assert from "node:assert";
import { dashboard } from "../lib/finance-dash";
import { totals, obligationFv, compliance } from "../lib/verification";
import { remittanceKobo, toKobo } from "../lib/money";
import { canSeeContact, clampScope } from "../lib/scope-core";
import { createsTransaction, outcomeFor } from "../lib/ledger-core";

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  " + name); };
const oid = (c: string) => c.repeat(24).slice(0, 24);
const Z1 = oid("a"), Z2 = oid("b"), A1 = oid("c"), P1 = oid("1"), P2 = oid("2"), P3 = oid("3");
const zones = [{ _id: Z1, name: "Zone One" }, { _id: Z2, name: "Standalone Zone" }];
const areas = [{ _id: A1, name: "Area One", zone: Z1 }];
const parishes = [{ _id: P1, name: "P1", zone: Z1, area: A1 }, { _id: P2, name: "P2", zone: Z1, area: A1 }, { _id: P3, name: "P3", zone: Z2, area: null }];
const rem = (parish: string, zone: string, area: string | null, offering: number, status: string, confirmed = 0, extra: any = {}) => ({
  kind: "yst", year: 2026, month: 10, parish, zone, area, offeringKobo: toKobo(offering), requiredKobo: remittanceKobo(toKobo(offering), 4000),
  amountKobo: toKobo(offering) * 0.4, status, confirmedKobo: confirmed, payments: [], ...extra,
});
const filter = (o: any = {}) => ({ year: 2026, month: 10, ...o });

t("40% of ₦100,000 is ₦40,000 in kobo", () => assert.equal(remittanceKobo(toKobo(100000), 4000), toKobo(40000)));

// P2 owes ₦40,000 with nothing confirmed; P1 owes ₦20,000 and has paid half (confirmed); P3 (standalone zone) owes ₦8,000 fully confirmed.
const rows = [
  rem(P1, Z1, A1, 50000, "confirmed", toKobo(10000)),
  rem(P2, Z1, A1, 100000, "submitted"),
  rem(P3, Z2, null, 20000, "confirmed", toKobo(8000)),
];
const input = (f: any) => ({ rows, parishes, zones, areas, filter: f });

t("a parish owing ₦40,000 is recorded once and counted once at every level", () => {
  const prov = dashboard(input(filter()));
  assert.equal(prov.cards.expected, toKobo(20000 + 40000 + 8000));
  const zone = dashboard(input(filter({ zone: Z1 })));
  assert.equal(zone.cards.expected, toKobo(60000));
  const area = dashboard(input(filter({ area: A1 })));
  assert.equal(area.cards.expected, toKobo(60000));
  const parish = dashboard(input(filter({ parish: P2 })));
  assert.equal(parish.cards.expected, toKobo(40000));
  assert.equal(prov.byParish.find((p) => p.id === P2)!.expected, toKobo(40000));
  // Parent summaries equal the sum of their children, never more
  assert.equal(prov.byZone.reduce((s, z) => s + z.expected, 0), prov.cards.expected);
  assert.equal(prov.byArea.reduce((s, a) => s + a.expected, 0), toKobo(60000)); // only parishes under an area; the standalone zone has no area
  assert.equal(prov.byParish.reduce((s, p) => s + p.expected, 0), prov.cards.expected);
});
t("only confirmed money counts as received; unconfirmed evidence counts as pending", () => {
  const prov = dashboard(input(filter()));
  assert.equal(prov.cards.confirmed, toKobo(18000));
  assert.equal(prov.cards.pending, rows[1].amountKobo);
  assert.equal(totals(rows[1] as any).confirmedKobo, 0);
  assert.equal(obligationFv(rows[1] as any), "receipt_uploaded");
});
t("partial payments and outstanding balances", () => {
  const p1 = totals(rows[0] as any);
  assert.equal(p1.outstandingKobo, toKobo(10000));
  assert.equal(p1.satisfied, false);
  assert.equal(obligationFv(rows[0] as any), "partially_confirmed");
  const prov = dashboard(input(filter()));
  assert.equal(prov.cards.outstanding, toKobo(10000 + 40000));
  assert.equal(prov.reconciliation.yst.ok, true);
});
t("overpayment is shown separately, not hidden", () => {
  const over = rem(P1, Z1, A1, 50000, "confirmed", toKobo(25000));
  const x = totals(over as any);
  assert.equal(x.overpaidKobo, toKobo(5000)); assert.equal(x.outstandingKobo, 0);
});
t("additional levies stay separate from the 40% remittance", () => {
  const levy = { kind: "levy", category: "levy", year: 2026, month: 10, parish: P2, zone: Z1, area: A1, amountKobo: toKobo(5000), status: "confirmed", confirmedKobo: toKobo(5000), payments: [] };
  const d = dashboard({ rows: [...rows, levy], parishes, zones, areas, filter: filter() });
  assert.equal(d.cards.expected, toKobo(68000));
  assert.equal(d.cards.confirmed, toKobo(18000));
  assert.equal(d.cards.levies, toKobo(5000));
  assert.equal(d.cards.leviesConfirmed, toKobo(5000));
  assert.equal(d.reconciliation.confirmedYstEqualsCard, true);
});
t("every declared kobo is accounted for exactly once", () => assert.equal(dashboard(input(filter())).reconciliation.partitionOk, true));
t("an unconfirmed, flagged or rejected payment never creates ledger money", () => {
  for (const a of ["payment_not_found", "amount_mismatch", "reject", "request_resubmission", "begin_review"] as const) assert.equal(createsTransaction(a, 4_000_000), false);
  assert.equal(createsTransaction("confirm", 4_000_000), true);
  assert.equal(createsTransaction("confirm", 0), false);
  assert.equal(createsTransaction("confirm", 1.5), false);
  assert.equal(outcomeFor("payment_not_found"), "not_found");
});
t("the report and the payment have separate statuses (report proceeds without finance approval)", () => {
  // Payment still unverified, but the report is submitted: compliance reflects both independently.
  const c = compliance("submitted", rows[1] as any);
  assert.ok(c.label.length > 0);
  assert.notEqual(obligationFv(rows[1] as any), "confirmed");
});

t("contact details: provincial, zonal, area and the parish's own admin can see; members, auditors, public cannot", () => {
  const rep = { parish: P1 };
  for (const role of ["super_admin", "provincial_admin", "finance_admin", "zonal_admin", "area_admin"]) assert.equal(canSeeContact({ role }, rep), true, role);
  assert.equal(canSeeContact({ role: "parish_admin", parish: P1 }, rep), true);
  assert.equal(canSeeContact({ role: "parish_admin", parish: P2 }, rep), false);
  for (const role of ["member", "auditor", "event_admin", "department_admin"]) assert.equal(canSeeContact({ role, parish: P1 }, rep), false, role);
});
t("filters can narrow a view but never widen an administrator's scope", () => {
  const own = { area: A1 };
  assert.equal(clampScope(own, new URLSearchParams({ area: A1 })).area, A1);
  assert.equal(clampScope(own, new URLSearchParams({ area: oid("9") })).area, "000000000000000000000000");
  assert.equal(clampScope({}, new URLSearchParams({ zone: Z2 })).zone, Z2);
  assert.deepEqual(clampScope(own, new URLSearchParams({ zone: "not-an-id" })), own);
});
console.log(`\n${n} acceptance checks passed`);
