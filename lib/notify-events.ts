/**
 * The notification catalogue. Client-safe. Every event belongs to a category; the category decides whether a
 * person may switch it off. In-app notices are never switched off, so nothing important is lost.
 */
export type Category = "reports" | "payments" | "announcements" | "events" | "tasks" | "general";

export const CATEGORIES: Record<Category, { label: string; locked: boolean; help: string }> = {
  reports: { label: "Monthly reports", locked: true, help: "Deadlines, submissions, revision requests. Needed to do your job, so email and push stay on." },
  payments: { label: "Payments and finance", locked: true, help: "Evidence, confirmations, mismatches and outstanding amounts. Always sent." },
  announcements: { label: "Announcements", locked: false, help: "News and messages from your leaders." },
  events: { label: "Events", locked: false, help: "Registration confirmations, reminders and cancellations." },
  tasks: { label: "Tasks and meetings", locked: false, help: "Tasks assigned to you and meeting reminders." },
  general: { label: "Other updates", locked: false, help: "Everything else." },
};

export const EVENTS = {
  report_deadline: { category: "reports", label: "Monthly report deadline", who: "Parish, area and zonal administrators who haven't submitted" },
  report_submitted: { category: "reports", label: "Monthly report submitted", who: "The administrators above the submitter" },
  report_incomplete: { category: "reports", label: "Incomplete report", who: "The submitter (draft left unfinished, or marked incomplete)" },
  report_completed: { category: "reports", label: "Report completed", who: "The submitting administrators" },
  report_revision: { category: "reports", label: "Revision requested", who: "The submitting administrator" },
  payment_uploaded: { category: "payments", label: "Payment evidence uploaded", who: "Provincial finance team" },
  ai_examined: { category: "payments", label: "AI examination completed", who: "Provincial finance team" },
  payment_adjusted: { category: "payments", label: "Payment record adjusted", who: "Provincial finance team" },
  payment_confirmed: { category: "payments", label: "Financial confirmation", who: "The parish's administrators" },
  payment_not_found: { category: "payments", label: "Payment not found", who: "The parish's administrators" },
  amount_mismatch: { category: "payments", label: "Amount mismatch", who: "The parish's administrators" },
  evidence_rejected: { category: "payments", label: "Evidence rejected", who: "The parish's administrators" },
  evidence_requested: { category: "payments", label: "Additional evidence requested", who: "The parish's administrators" },
  outstanding: { category: "payments", label: "Outstanding obligation", who: "Parish administrators with an unpaid or part-paid remittance" },
  announcement: { category: "announcements", label: "New announcement", who: "Everyone or the audience the sender chose" },
  event_registered: { category: "events", label: "Event registration", who: "The registrant" },
  event_reminder: { category: "events", label: "Event reminder", who: "Registrants of events starting soon" },
  event_cancelled: { category: "events", label: "Event cancellation", who: "Everyone registered" },
  task_assigned: { category: "tasks", label: "Administrative task", who: "The person it is assigned to" },
  task_overdue: { category: "tasks", label: "Overdue task", who: "The person it is assigned to" },
  meeting_reminder: { category: "tasks", label: "Meeting reminder", who: "Committee members" },
  general: { category: "general", label: "General", who: "As chosen by the sender" },
} as const satisfies Record<string, { category: Category; label: string; who: string }>;
export type EventKey = keyof typeof EVENTS;

export const categoryOf = (event?: string): Category => ((event && (EVENTS as Record<string, { category: Category }>)[event]?.category) || "general") as Category;
export const OPTIONAL_CATEGORIES = (Object.keys(CATEGORIES) as Category[]).filter((c) => !CATEGORIES[c].locked);

export type Prefs = { email?: boolean; push?: boolean; sms?: boolean; mute?: string[] };
/**
 * May this person receive this category on an outside channel? Their own channel switch always applies.
 * A category can only be muted when it is optional. In-app notices are not decided here: they are always on.
 */
export function channelOn(prefs: Prefs | undefined, channel: "email" | "push", category: Category) {
  const p = prefs ?? {};
  if ((channel === "email" ? p.email : p.push) === false) return false;
  return CATEGORIES[category].locked || !(p.mute ?? []).includes(category);
}
