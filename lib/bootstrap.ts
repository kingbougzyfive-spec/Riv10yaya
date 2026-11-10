import { audit } from "./api";
import { hashPassword } from "./auth";
import { getDb } from "./db";
import { passwordProblem } from "./password";

let done = false;

/** Temporary first administrator for a new deployment.
 *
 *  Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD as server environment variables (never NEXT_PUBLIC_*).
 *  On the first request to an EMPTY database a Super Administrator is created from them. The password is hashed
 *  before it is stored, is never logged or sent to the browser, and the account is flagged so its owner must
 *  choose a new password at first sign-in. Remove both variables once it has been replaced; the Security page
 *  warns while they are still set. Nothing happens if any user already exists. */
export async function ensureBootstrapAdmin(): Promise<void> {
  if (done) return;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) { done = true; return; }
  try {
    const { User } = await getDb();
    if ((await User.estimatedDocumentCount()) > 0 || (await User.countDocuments({})) > 0) { done = true; return; }
    const problem = passwordProblem(password, { email });
    if (problem || !/^\S+@\S+\.\S+$/.test(email)) {
      console.error(`BOOTSTRAP_ADMIN_* ignored: ${problem || "email is not valid"}`);
      done = true;
      return;
    }
    const u = await User.create({
      name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Temporary Administrator",
      email, role: "super_admin", passwordHash: await hashPassword(password),
      mustChangePassword: true, bootstrap: true, passwordChangedAt: new Date(),
    });
    await audit({ id: String(u._id), name: u.name, email, role: "super_admin" }, "bootstrap.admin_created", email, { entity: "user", entityId: String(u._id), reason: "First-run temporary administrator from server environment" });
    done = true;
  } catch (e) {
    console.error("bootstrap admin failed", e);
  }
}
