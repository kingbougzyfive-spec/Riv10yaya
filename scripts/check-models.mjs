// Verifies every model in the specification maps to a registered collection and that key integrity rules exist.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const models = readFileSync(join(root, "lib/models.ts"), "utf8");
const map = readFileSync(join(root, "lib/model-map.ts"), "utf8");
const reg = models.match(/SYNC_COLLECTIONS = \[(.*?)\] as const/s)[1].match(/"([A-Za-z]+)"/g).map((s) => s.slice(1, -1));
let bad = 0; const t = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) bad++; };
const entries = [...map.matchAll(/^\s{2}(\w+): \{ model: "(\w+)"/gm)];
t(entries.length === 33, `${entries.length} specification models mapped (expected 33)`);
for (const [, spec, m] of entries) t(reg.includes(m), `${spec} -> ${m} is registered`);
for (const [what, re] of [
  ["one yst remittance per parish per period", /remittanceSchema\.index\(\{ parish: 1, month: 1, year: 1 \}, \{ unique: true, partialFilterExpression: \{ kind: "yst" \}/],
  ["one report per level per place per period", /reportSchema\.index\(\{ type: 1, zone: 1, area: 1, parish: 1, month: 1, year: 1 \}, \{ unique: true \}/],
  ["one levy record per parish per levy", /parish: 1, levy: 1 \}, \{ unique: true/],
  ["organisation chain enforced on remittances", /orgChain\(remittanceSchema\)/],
  ["organisation chain enforced on parishes", /orgChain\(parishSchema/],
  ["report shape enforced", /reportShapeProblem/],
  ["period locking", /is locked and accepts no new submissions/],
  ["approvals and confirmed payments immutable", /Financial approvals.*Confirmed payments/s],
]) t(re.test(models), what);
const extra = readFileSync(join(root, "lib/schemas-extra.ts"), "utf8");
t(/bankReference: 1 \}, \{ unique: true/.test(extra), "a bank reference can be confirmed only once");
t(/remittance: 1, paymentKey: 1 \}, \{ unique: true/.test(extra), "a payment can be confirmed only once");
process.exit(bad ? 1 : 0);
