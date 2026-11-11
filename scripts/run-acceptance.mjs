// Compiles and runs tests/acceptance.logic.ts. Needs `tsc` (npm i -D typescript) or TSC=/path/to/tsc.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "acc-"));
const tsc = process.env.TSC || join(root, "node_modules/.bin/tsc");
try { execFileSync(tsc, ["--target", "es2022", "--module", "node16", "--moduleResolution", "node16", "--ignoreConfig", "--skipLibCheck", "--outDir", out, "--rootDir", root, join(root, "tests/acceptance.logic.ts")], { stdio: "pipe", cwd: root }); } catch (e) { const m = String(e.stdout || ""); const real = m.split("\n").filter((l) => /error TS/.test(l) && !/TS2591|TS2307/.test(l)); if (real.length) { console.log(real.join("\n")); process.exit(1); } } // type-definition noise only: output is still emitted
writeFileSync(join(out, "package.json"), '{"type":"commonjs"}');
execFileSync("node", [join(out, "tests/acceptance.logic.js")], { stdio: "inherit" });
