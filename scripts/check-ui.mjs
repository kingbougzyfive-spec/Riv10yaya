// Guards the section 22/23 rules. node scripts/check-ui.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { if (f === "node_modules" || f === ".next" || f.startsWith(".")) continue; const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?)$/.test(f) && files.push(p); } })(root);
let bad = 0;
const fail = (m) => { bad++; console.log("FAIL " + m); };
for (const f of files) {
  const rel = f.slice(root.length + 1), s = readFileSync(f, "utf8");
  if (rel.startsWith("components") || rel.startsWith("app")) {
    if (/[^.\w](window\.)?(confirm|alert|prompt)\(/.test(s.replace(/await confirm\(|!confirm\(|\(await confirm\(|useConfirm|const confirm|ask\(/g, "")) && !rel.endsWith("ConfirmDialog.tsx")) fail(`${rel}: native confirm/alert/prompt (use useConfirm / toast)`);
    if (/text-white\/(?:[1-5]\d?|60)\b/.test(s)) fail(`${rel}: text below the contrast floor (use text-white/65 or stronger)`);
    if (/onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}|onClick=\{undefined\}/.test(s)) fail(`${rel}: button with an empty handler`);
    if (/href="#"/.test(s)) fail(`${rel}: placeholder link href="#"`);
    if (/₦\s?\d[\d,]{3,}/.test(s) && !rel.includes("docs")) fail(`${rel}: hardcoded naira amount (money must come from the database)`);
  }
}
console.log(bad ? `${bad} problem(s)` : `ui checks passed (${files.length} files)`);
process.exit(bad ? 1 : 0);
