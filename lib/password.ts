import { z } from "zod";

const COMMON = ["password", "password1", "password12", "password123", "1234567890", "12345678910", "qwertyuiop", "qwerty12345", "iloveyou12", "welcome123", "admin12345", "changeme123", "letmein123", "yaya123456", "rccg123456", "rivers10"];

/** One policy for every place a password is chosen. Returns a message, or null when the password is fine. */
export function passwordProblem(pw: string, ctx?: { email?: string; name?: string }): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 100) return "Use at most 100 characters.";
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) return "That password is too easy to guess. Choose something less common.";
  if (/^(.)\1+$/.test(pw)) return "Don't repeat one character.";
  const local = ctx?.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && low.includes(local)) return "Don't use your email address in your password.";
  return null;
}

export const passwordField = z.string().max(100).superRefine((v, c) => { const m = passwordProblem(v); if (m) c.addIssue({ code: "custom", message: m }); });
