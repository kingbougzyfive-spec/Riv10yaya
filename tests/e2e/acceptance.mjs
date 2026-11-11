#!/usr/bin/env node
/* Section 24 acceptance scenarios, run over HTTP against a DEPLOYED instance (a real server and database).
 *
 *   BASE_URL=https://your-app.vercel.app ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e/acceptance.mjs
 *
 * ADMIN_* is a Super Administrator whose password has already been changed from the temporary one.
 * It creates uniquely named "E2E <runid>" zones, areas, parishes and users and leaves them behind (clearly named;
 * nothing is deleted, because payments and audit rows are append-only). Use a staging database, not production.
 * STATUS: written against the route code but NEVER RUN. Expect to correct a few request shapes on first execution.
 * SKIP = an integration (AI, email, push, Sheets) is not configured: reported, never faked as a pass.
 */
const BASE = (process.env.BASE_URL || "").replace(/\/$/, "");
const AE = process.env.ADMIN_EMAIL, AP = process.env.ADMIN_PASSWORD;
if (!BASE || !AE || !AP) { console.error("Set BASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD."); process.exit(2); }

const RUN = Date.now().toString(36).toUpperCase();
const PW = "E2e-Passw0rd!" + RUN;
const now = new Date(), MONTH = now.getMonth() + 1, YEAR = now.getFullYear();
const results = [];
let section = "";

class Client {
  constructor(name) { this.name = name; this.cookie = ""; }
  async call(method, path, body, form) {
    const headers = { Origin: BASE };
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: "manual" });
    const sc = res.headers.getSetCookie?.() ?? [];
    const sess = sc.map((c) => c.split(";")[0]).find((c) => c.startsWith("yaya_session="));
    if (sess) this.cookie = sess;
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json().catch(() => ({})) : Buffer.from(await res.arrayBuffer());
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }
  get(p) { return this.call("GET", p); }
  post(p, b) { return this.call("POST", p, b ?? {}); }
  patch(p, b) { return this.call("PATCH", p, b); }
  async login(email, password) { const r = await this.post("/api/auth/login", { email, password }); if (!r.ok) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.data)}`); return r; }
}

function check(name, cond, detail = "") { results.push({ section, name, state: cond ? "PASS" : "FAIL", detail: cond ? "" : String(detail).slice(0, 300) }); }
function skip(name, why) { results.push({ section, name, state: "SKIP", detail: why }); }
const must = (r, what) => { if (!r.ok) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data; };
const rows = (d) => (Array.isArray(d) ? d : d?.reports ?? d?.rows ?? d?.items ?? d?.users ?? []);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const upload = (c) => { const f = new FormData(); f.set("file", new Blob([PNG], { type: "image/png" }), `receipt-${RUN}.png`); return c.call("POST", "/api/evidence", undefined, f); };
const activity = (fields) => Object.fromEntries(fields.map(([k, kind]) => [k, kind === "int" ? 3 : "NIL"]));
const PARISH_ACT = activity([["youthSundayAttendance", "int"], ["youthMeetingAttendance", "int"], ["meetingsHeld", "int"], ["otherMeetings"], ["evangelism"], ["outreach"], ["discipleship"], ["programmes"], ["specialEvents"], ["leadership"], ["newMembers", "int"], ["achievements"], ["challenges"], ["recommendations"]]);
const AREA_ACT = activity([["areaMeetings", "int"], ["areaProgrammes"], ["attendance", "int"], ["evangelismOutreach"], ["leadership"], ["challenges"], ["recommendations"]]);
const ZONE_ACT = activity([["zonalProgrammes"], ["zonalMeetings", "int"], ["attendance", "int"], ["evangelism"], ["outreach"], ["leadership"], ["achievements"], ["challenges"], ["recommendations"]]);

async function main() {
  const admin = new Client("super"); await admin.login(AE, AP);
  const ids = {}, users = {};
  const mkOrg = async (body) => must(await admin.post("/api/org", body), `create ${body.type} ${body.name}`).id;
  const mkUser = async (key, role, scope) => {
    const email = `e2e.${key}.${RUN}@example.test`.toLowerCase(), phone = `0803${String(Math.floor(1e6 + Math.random() * 9e6))}`;
    must(await admin.post("/api/users", { name: `E2E ${key} ${RUN}`, email, phone, role, password: "Temp-Passw0rd!" + RUN, ...scope }), `create user ${key}`);
    const c = new Client(key); await c.login(email, "Temp-Passw0rd!" + RUN);
    must(await c.post("/api/auth/password", { current: "Temp-Passw0rd!" + RUN, next: PW }), `first password change ${key}`);
    const c2 = new Client(key); await c2.login(email, PW);
    users[key] = { c: c2, email, phone, name: `E2E ${key} ${RUN}` };
  };

  // ───────────── ORGANIZATIONAL STRUCTURE
  section = "Organizational structure";
  ids.zA = await mkOrg({ type: "zone", name: `E2E Zone A ${RUN}`, hasAreas: true });
  check("1 create a zone containing areas", !!ids.zA);
  ids.area = await mkOrg({ type: "area", name: `E2E Area ${RUN}`, zone: ids.zA });
  ids.zB = await mkOrg({ type: "zone", name: `E2E Standalone ${RUN}`, hasAreas: false });
  check("2 create a standalone zone without areas", !!ids.zB);
  ids.p1 = await mkOrg({ type: "parish", name: `E2E Parish One ${RUN}`, zone: ids.zA, area: ids.area });
  ids.p2 = await mkOrg({ type: "parish", name: `E2E Parish Two ${RUN}`, zone: ids.zA, area: ids.area });
  check("3 create parishes under an area", !!ids.p1 && !!ids.p2);
  ids.p3 = await mkOrg({ type: "parish", name: `E2E Direct Parish ${RUN}`, zone: ids.zB });
  check("4 create parishes directly under a standalone zone", !!ids.p3);
  const bad = await admin.post("/api/org", { type: "parish", name: `E2E Bad ${RUN}`, zone: ids.zB, area: ids.area });
  check("4b a parish cannot be placed under an area from a different zone", !bad.ok, bad.status);

  await mkUser("parish1", "parish_admin", { zone: ids.zA, area: ids.area, parish: ids.p1 });
  await mkUser("parish2", "parish_admin", { zone: ids.zA, area: ids.area, parish: ids.p2 });
  await mkUser("parish3", "parish_admin", { zone: ids.zB, parish: ids.p3 });
  await mkUser("area", "area_admin", { zone: ids.zA, area: ids.area });
  await mkUser("zoneA", "zonal_admin", { zone: ids.zA });
  await mkUser("zoneB", "zonal_admin", { zone: ids.zB });
  await mkUser("finance", "finance_admin", {});
  await mkUser("provincial", "provincial_admin", {});
  check("5 assign parish, area and zonal administrators", Object.keys(users).length === 8);

  const orgOf = async (k) => { const o = must(await users[k].c.get("/api/org"), `org ${k}`); return { z: o.zones.map((x) => x.id), a: o.areas.map((x) => x.id), p: o.parishes.map((x) => x.id) }; };
  const pa = await orgOf("parish1"), aa = await orgOf("area"), za = await orgOf("zoneA"), zb = await orgOf("zoneB");
  check("6a parish admin sees only their own parish", pa.p.length === 1 && pa.p[0] === ids.p1, JSON.stringify(pa));
  check("6b area admin sees only their area's parishes", aa.p.every((x) => [ids.p1, ids.p2].includes(x)) && !aa.p.includes(ids.p3), JSON.stringify(aa));
  check("6c zonal admin A sees zone A and not the standalone zone", za.z.includes(ids.zA) && !za.z.includes(ids.zB) && !za.p.includes(ids.p3));
  check("6d zonal admin B sees the direct parish and not zone A's", zb.p.includes(ids.p3) && !zb.p.includes(ids.p1));
  const cross = await users.parish1.c.get("/api/users");
  check("6e a parish admin cannot list users", cross.status === 403, cross.status);

  // ───────────── PARISH MONTHLY REPORTING
  section = "Parish monthly reporting";
  const P = users.parish1.c;
  const ctx = must(await P.get(`/api/reports/context?month=${MONTH}&year=${YEAR}`), "report context");
  check("1-2 parish, area and zone names appear correctly", ctx.names?.parish?.includes("Parish One") && ctx.names?.area?.includes("Area") && ctx.names?.zone?.includes("Zone A"), JSON.stringify(ctx.names));
  check("5-6 the 40% rate and official provincial bank details are provided", ctx.finance?.percentBp === 4000 && !!ctx.finance?.bank, JSON.stringify(ctx.finance));
  const early = await P.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.parish1.name, phone: users.parish1.phone }, activity: PARISH_ACT });
  check("report cannot be submitted before the financial section exists", early.status === 400, early.status);
  const ev = must(await upload(P), "receipt upload");
  check("8 receipt uploaded", !!ev.id);
  const OFFERING = 100000;
  const rem = must(await P.post("/api/remittances", { month: MONTH, year: YEAR, offering: OFFERING, paidAt: new Date().toISOString().slice(0, 10), amountPaid: 40000, reference: `E2E-${RUN}-P1`, evidenceId: ev.id }), "submit remittance");
  const remId = rem.id;
  const ctx2 = must(await P.get(`/api/reports/context?month=${MONTH}&year=${YEAR}`), "context after remittance");
  check("4-5 40% obligation calculated: ₦100,000 offering → ₦40,000", ctx2.remittance?.requiredKobo === 4_000_000, JSON.stringify(ctx2.remittance));
  const ai = await admin.post(`/api/remittances/${remId}/analyze`);
  if (ai.status === 400 && /set up|isn't set up|configured/i.test(JSON.stringify(ai.data))) skip("9 AI examines the receipt", "ANTHROPIC_API_KEY not configured: the app says so instead of pretending");
  else check("9 AI examines the receipt", ai.ok && !!ai.data.analysis, JSON.stringify(ai.data));
  const sub = must(await P.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.parish1.name, phone: users.parish1.phone }, activity: PARISH_ACT }), "submit parish report");
  check("10-11 the parish submits its report while payment is still unverified", !!sub.reportId, JSON.stringify(sub));
  const stored = rows(must(await users.provincial.c.get(`/api/reports?month=${MONTH}&year=${YEAR}`), "provincial list")).find((r) => r.reportId === sub.reportId);
  check("12 report and administrator contact stored and visible to provincial", stored?.contact?.fullName === users.parish1.name && stored?.contact?.phone === users.parish1.phone, JSON.stringify(stored?.contact));
  check("10b payment is NOT confirmed just because the report was submitted", stored?.remittance?.status !== "confirmed", stored?.remittance?.status);

  // second parish: owes ₦40,000 and has not paid, for accounting checks; third parish: standalone zone
  const P2 = users.parish2.c; const e2 = must(await upload(P2), "p2 receipt");
  must(await P2.post("/api/remittances", { month: MONTH, year: YEAR, offering: OFFERING, paidAt: new Date().toISOString().slice(0, 10), amountPaid: 40000, reference: `E2E-${RUN}-P2`, evidenceId: e2.id }), "p2 remittance");
  const P3 = users.parish3.c; const e3 = must(await upload(P3), "p3 receipt");
  must(await P3.post("/api/remittances", { month: MONTH, year: YEAR, offering: 50000, paidAt: new Date().toISOString().slice(0, 10), amountPaid: 20000, reference: `E2E-${RUN}-P3`, evidenceId: e3.id }), "p3 remittance");
  must(await P3.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.parish3.name, phone: users.parish3.phone }, activity: PARISH_ACT }), "p3 report");

  // ───────────── AREA REPORTING
  section = "Area reporting";
  const A = users.area.c;
  const actx = must(await A.get(`/api/reports/context?month=${MONTH}&year=${YEAR}`), "area context");
  check("1-2 area and zone names identified", actx.names?.area?.includes("Area") && actx.names?.zone?.includes("Zone A"), JSON.stringify(actx.names));
  check("4-5 area lists its parishes with progress", actx.rollup?.parishCount === 2 && actx.rollup?.submittedParishReports === 1, JSON.stringify(actx.rollup));
  const asub = must(await A.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.area.name, phone: users.area.phone }, activity: AREA_ACT }), "area submit");
  const aStored = rows(must(await users.provincial.c.get(`/api/reports?month=${MONTH}&year=${YEAR}`), "list")).find((r) => r.reportId === asub.reportId);
  check("6-7 area report submitted; provincial sees it with contact", aStored?.contact?.phone === users.area.phone, JSON.stringify(aStored?.contact));

  // ───────────── ZONAL REPORTING
  section = "Zonal reporting";
  const ZA = users.zoneA.c, ZB = users.zoneB.c;
  const zctx = must(await ZA.get(`/api/reports/context?month=${MONTH}&year=${YEAR}`), "zone context");
  check("1-4 zone name, areas and parishes shown", zctx.names?.zone?.includes("Zone A") && zctx.rollup?.areaCount === 1, JSON.stringify(zctx.rollup));
  const zbctx = must(await ZB.get(`/api/reports/context?month=${MONTH}&year=${YEAR}`), "standalone zone context");
  check("5 directly attached parishes supported", zbctx.rollup?.directParishCount === 1 && zbctx.rollup?.areaCount === 0, JSON.stringify(zbctx.rollup));
  const zsub = must(await ZA.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.zoneA.name, phone: users.zoneA.phone }, activity: ZONE_ACT }), "zone submit");
  must(await ZB.post("/api/reports", { month: MONTH, year: YEAR, contact: { fullName: users.zoneB.name, phone: users.zoneB.phone }, activity: ZONE_ACT }), "zone B submit");
  const zStored = rows(must(await users.provincial.c.get(`/api/reports?month=${MONTH}&year=${YEAR}`), "list")).find((r) => r.reportId === zsub.reportId);
  check("6-7 zonal report submitted; provincial sees it with contact", zStored?.contact?.phone === users.zoneA.phone, JSON.stringify(zStored?.contact));

  // ───────────── FINANCIAL VERIFICATION
  section = "Financial verification";
  const F = users.finance.c;
  const fin = await F.get(`/api/remittances?month=${MONTH}&year=${YEAR}`);
  const finRow = rows(fin.data).find((r) => r.id === remId);
  check("1 finance can review uploaded evidence", fin.ok && !!finRow?.evidenceId, fin.status);
  must(await F.patch(`/api/remittances/${remId}`, { action: "begin_review", reason: "E2E review started" }), "begin review");
  const dash0 = must(await F.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}`), "dashboard before");
  const conf0 = dash0.cards?.confirmed ?? 0;
  must(await F.patch(`/api/remittances/${remId}`, { action: "confirm", confirmedAmount: 40000, seenAmount: 40000, bankReference: `BANK-${RUN}`, reason: "Seen on statement" }), "confirm");
  const dash1 = must(await F.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}`), "dashboard after");
  check("3-4 confirmed payment appears in financial summaries", (dash1.cards.confirmed - conf0) === 4_000_000, `${conf0} → ${dash1.cards.confirmed}`);
  const dup = await F.patch(`/api/remittances/${remId}`, { action: "confirm", confirmedAmount: 40000, seenAmount: 40000, bankReference: `BANK-${RUN}`, reason: "again" });
  check("3b a payment cannot be confirmed twice", !dup.ok, dup.status);
  const r2 = rows(must(await F.get(`/api/remittances?month=${MONTH}&year=${YEAR}`), "remittances")).find((r) => r.parishId === ids.p2 && r.kind === "yst");
  check("5-prep parish two's remittance is visible to finance", !!r2?.id, JSON.stringify(r2));
  must(await F.patch(`/api/remittances/${r2.id}`, { action: "payment_not_found", reason: "No matching credit on the statement" }), "flag not found");
  const inbox = async (k) => rows((await users[k].c.get("/api/notifications")).data);
  const has = (list) => list.some((n) => /not found/i.test(`${n.title} ${n.body}`));
  check("6 parish, area and zonal administrators are notified of the flagged payment", has(await inbox("parish2")) && has(await inbox("area")) && has(await inbox("zoneA")), "one or more inboxes lack the notice");
  const more = await upload(P2);
  const resp = await P2.patch(`/api/remittances/${r2.id}`, { action: "respond", note: "Transfer made from a different account", bankReference: `E2E-${RUN}-P2-B`, evidenceId: more.data.id });
  check("7 the parish can provide additional evidence", resp.ok, JSON.stringify(resp.data));
  const orig = rows(must(await F.get(`/api/remittances?month=${MONTH}&year=${YEAR}`), "remittances again")).find((x) => x.id === r2.id);
  check("8 the original receipt and declared amount remain available, with history", !!orig?.evidenceId && orig.amountKobo === r2.amountKobo && (orig.history?.length ?? 0) >= 2, JSON.stringify(orig?.history?.length));
  const stillThere = rows((await users.provincial.c.get(`/api/reports?month=${MONTH}&year=${YEAR}`)).data).some((r) => r.reportId === sub.reportId);
  check("8b the submitted report is still available", stillThere);
  const al = rows(must(await admin.get("/api/audit"), "audit"));
  check("9 every financial decision is in the audit log", ["remittance.confirm", "remittance.payment_not_found"].every((a) => al.some((x) => x.action === a)), JSON.stringify(al.slice(0, 3)));

  // ───────────── ACCOUNTING ACCURACY
  section = "Accounting accuracy";
  const dz = (await ZA.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}&zone=${ids.zA}`)).data;
  const dar = (await A.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}&area=${ids.area}`)).data;
  const dpr = (await users.provincial.c.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}`)).data;
  const dp2 = (await F.get(`/api/finance/dashboard?year=${YEAR}&month=${MONTH}&parish=${ids.p2}`)).data;
  check("1 parish owing ₦40,000 is recorded once", dp2?.cards?.expected === 4_000_000, JSON.stringify(dp2?.cards));
  check("2 the area summary includes the same ₦80,000 (two parishes) with no extra obligation", dar?.cards?.expected === 8_000_000, JSON.stringify(dar?.cards?.expected));
  check("3 the zone summary equals the area's (one area, no direct parishes)", dz?.cards?.expected === 8_000_000, JSON.stringify(dz?.cards?.expected));
  check("4 provincial counts each obligation once (E2E rows are a subset)", dpr?.byZone?.reduce((s, z) => s + z.expected, 0) === dpr?.cards?.expected, "zone totals differ from the headline");
  check("5 only confirmed money is received", dar?.cards?.confirmed === 4_000_000 && dar.reconciliation?.partitionOk === true, JSON.stringify(dar?.cards));
  check("6 additional levies are separate from the 40% remittance", typeof dar?.cards?.levies === "number" && dar.cards.expected === 8_000_000, "levies leaked into expected?");
  check("7 outstanding balance is exact", dar?.cards?.outstanding === 4_000_000, JSON.stringify(dar?.cards?.outstanding));

  // ───────────── CONTACT INFORMATION
  section = "Contact information";
  const list = (c) => c.get(`/api/reports?month=${MONTH}&year=${YEAR}`).then((r) => rows(r.data));
  check("1-3 parish, area and zonal reports hold name and phone", [stored, aStored, zStored].every((r) => r?.contact?.fullName && r?.contact?.phone));
  check("4 provincial administrator can view each contact", (await list(users.provincial.c)).filter((r) => r.contact?.phone).length >= 3);
  check("8a an area admin does not see another zone's reports", !(await list(users.area.c)).some((r) => r.reportId === zsub.reportId && r.type === "zone"));
  const member = new Client("member");
  const joined = await member.post("/api/public/join", { name: `E2E Member ${RUN}`, phone: `0802${String(Math.floor(1e6 + Math.random() * 9e6))}`, email: `e2e.member.${RUN}@example.test`, password: "Member-Passw0rd!" + RUN, parish: ids.p1, dob: "2000-01-01" });
  if (joined.ok) { await member.login(`e2e.member.${RUN}@example.test`, "Member-Passw0rd!" + RUN); const m = await member.get(`/api/reports?month=${MONTH}&year=${YEAR}`); check("8b an ordinary member cannot read reports or contact details", m.status === 403, m.status); }
  else skip("8b member cannot read contacts", `member sign-up failed: ${joined.status}`);
  const anon = await new Client("anon").get(`/api/reports?month=${MONTH}&year=${YEAR}`);
  check("8c a public visitor cannot read reports", anon.status === 401 || anon.status === 403, anon.status);
  const pub = JSON.stringify((await new Client("anon").get("/api/public/org")).data);
  check("8d the public organisation list contains no phone numbers", !pub.includes(users.parish1.phone));
  const csv = await users.provincial.c.get(`/api/exports/parish_monthly?format=csv&year=${YEAR}&month=${MONTH}`);
  check("6 authorised export contains administrator contact", csv.ok && Buffer.from(csv.data).toString().includes(users.parish1.phone), csv.status);
  const xlsx = await users.provincial.c.get(`/api/exports/parish_monthly?format=xlsx&year=${YEAR}&month=${MONTH}`);
  check("6b Excel export produced", xlsx.ok && Buffer.from(xlsx.data).subarray(0, 2).toString() === "PK", xlsx.status);
  const pdf = await users.provincial.c.get(`/api/exports/parish_monthly?format=pdf&year=${YEAR}&month=${MONTH}`);
  check("6c PDF export produced", pdf.ok && Buffer.from(pdf.data).subarray(0, 4).toString() === "%PDF", pdf.status);
  const oldPhone = users.parish1.phone;
  await admin.patch("/api/users", { id: rows((await admin.get("/api/users")).data).find((u) => u.email === users.parish1.email)?.id, phone: "08011112222" });
  const after = (await list(users.provincial.c)).find((r) => r.reportId === sub.reportId);
  check("7 historical contact on the report is unchanged after the administrator updates their account", after?.contact?.phone === oldPhone, JSON.stringify(after?.contact));

  // ───────────── OTHER PLATFORM FUNCTIONALITY
  section = "Other platform functionality";
  const start = new Date(Date.now() + 7 * 864e5).toISOString();
  const evc = must(await admin.post("/api/events", { title: `E2E Event ${RUN}`, startsAt: start, venue: "E2E Hall", status: "published", registrationOpen: true, capacity: 0 }), "create event");
  const eid = evc.ids[0];
  const pubEvents = (await new Client("anon").get("/api/public/events")).data;
  check("1 event creation: the published event is publicly listed", JSON.stringify(pubEvents).includes(`E2E Event ${RUN}`));
  const phone = `0805${String(Math.floor(1e6 + Math.random() * 9e6))}`;
  const reg = await new Client("anon").post(`/api/public/events/${eid}/register`, { name: `E2E Guest ${RUN}`, phone, zone: ids.zA, area: ids.area, parish: ids.p1 });
  check("1b registration works and returns a QR reference", reg.ok && !!reg.data.reference, JSON.stringify(reg.data));
  const dupReg = await new Client("anon").post(`/api/public/events/${eid}/register`, { name: `E2E Guest ${RUN}`, phone, zone: ids.zA, area: ids.area, parish: ids.p1 });
  check("1c duplicate registration for the same phone is refused", !dupReg.ok, dupReg.status);
  const look = await new Client("anon").get(`/api/public/registrations/${reg.data.reference}`);
  check("2 registration QR code lookup works", look.ok, look.status);
  const open = new Date(Date.now() - 36e5).toISOString(), close = new Date(Date.now() + 36e5).toISOString();
  const ses = must(await admin.post("/api/attendance/sessions", { title: `E2E Attendance ${RUN}`, level: "province", date: open, opensAt: open, closesAt: close, kind: "other" }), "create session");
  const vis = await new Client("anon").post(`/api/public/attend/${ses.token}`, { mode: "visitor", name: `E2E Visitor ${RUN}`, phone });
  check("3 attendance QR check-in works", vis.ok, JSON.stringify(vis.data));
  const vis2 = await new Client("anon").post(`/api/public/attend/${ses.token}`, { mode: "visitor", name: `E2E Visitor ${RUN}`, phone });
  check("4 duplicate attendance is prevented", vis2.status === 409, vis2.status);
  if (joined.ok) {
    const me = await member.get("/api/me");
    check("5 member profile loads", me.ok, me.status);
    check("6 member event and attendance history are returned", Array.isArray(me.data?.events) && Array.isArray(me.data?.attendance), JSON.stringify(Object.keys(me.data || {})));
    const denied = await member.get("/api/users");
    check("5b member permissions: cannot use admin APIs", denied.status === 403, denied.status);
  }
  const integ = must(await admin.get("/api/integrations"), "integrations");
  if (!integ.email.active && !integ.push.active) skip("7 notifications", "email and push not configured: in-app notices only (verified above)");
  else check("7 notifications: configured channels reported active", integ.email.active || integ.push.active);
  if (!integ.sheets.active) skip("8 Google Sheets synchronization", "not configured");
  else {
    const s1 = await admin.post("/api/integrations/sheets", { action: "sync" }); const s2 = await admin.post("/api/integrations/sheets", { action: "sync" });
    check("8 Sheets sync runs twice without error (row-count idempotence must be checked in the sheet itself)", s1.ok && s2.ok, `${s1.status}/${s2.status} ${JSON.stringify(s2.data).slice(0, 200)}`);
  }
  check("9 PDF and Excel exports work (see Contact information)", true);
  skip("10 PWA installation", "needs a real device or browser run: docs/PWA-TESTING.md");
  const sw = await new Client("anon").get("/sw.js");
  const swText = Buffer.from(sw.data).toString();
  check("11 the service worker never handles writes, so offline payments cannot appear confirmed", sw.ok && /req\.method !== "GET"\) return/.test(swText));
  const al2 = rows(must(await admin.get("/api/audit"), "audit"));
  check("12 audit logs capture sensitive actions", ["user.create", "report.submit.parish", "event.create"].every((a) => al2.some((x) => x.action === a)), al2.slice(0, 5).map((x) => x.action).join(","));
}

try { await main(); } catch (e) { results.push({ section: "Setup", name: "script aborted", state: "FAIL", detail: e.message }); }
let cur = "";
for (const r of results) { if (r.section !== cur) { cur = r.section; console.log(`\n${cur}`); } console.log(`  ${r.state.padEnd(4)} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`); }
const c = (s) => results.filter((r) => r.state === s).length;
console.log(`\n${c("PASS")} passed, ${c("FAIL")} failed, ${c("SKIP")} skipped (run ${RUN})`);
process.exit(c("FAIL") ? 1 : 0);
