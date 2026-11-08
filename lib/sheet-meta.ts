/** Client-safe description of the spreadsheet tabs and who may do what with them. */
export type TabGroup = "finance" | "general";
export const SHEET_TABS = [
  { key: "parishes", tab: "Master Parish Register", group: "general", help: "Every parish with its zone, area and administrator." },
  { key: "submissions", tab: "Monthly Parish Submissions", group: "general", help: "One row per parish report, with its payment status." },
  { key: "confirmed", tab: "Confirmed Payments", group: "finance", help: "Only payments finance has confirmed, plus audited adjustments." },
  { key: "outstanding", tab: "Outstanding Payments", group: "finance", help: "Youth Sunday obligations not yet covered by confirmed money." },
  { key: "pending", tab: "Pending Verification", group: "finance", help: "Payments awaiting finance, needing parish action, or rejected. Never counted as received." },
  { key: "levies", tab: "Additional Levies", group: "finance", help: "Levies set by the province, kept apart from Youth Sunday money." },
  { key: "contributions", tab: "Additional Contributions", group: "finance", help: "Voluntary contributions, reported separately from levies." },
  { key: "attendance", tab: "Parish Attendance", group: "general", help: "Attendance sessions held at parish level." },
  { key: "areas", tab: "Area Summary", group: "finance", help: "Per area and month: submissions, attendance and money." },
  { key: "zones", tab: "Zonal Summary", group: "finance", help: "Per zone and month." },
  { key: "province", tab: "Provincial Summary", group: "finance", help: "Province-wide totals per month." },
  { key: "registrations", tab: "Event Registrations", group: "general", help: "Registrations without phone or email; under-18 names are withheld." },
  { key: "eventAttendance", tab: "Event Attendance", group: "general", help: "Registered versus checked-in numbers per event." },
  { key: "activity", tab: "Monthly Activity Reports", group: "general", help: "The activity answers from parish, area and zonal reports." },
] as const satisfies readonly { key: string; tab: string; group: TabGroup; help: string }[];
export type SheetTabKey = (typeof SHEET_TABS)[number]["key"];
export const TAB_BY_KEY = Object.fromEntries(SHEET_TABS.map((t) => [t.key, t])) as Record<SheetTabKey, (typeof SHEET_TABS)[number]>;
export const isTabKey = (k: string): k is SheetTabKey => k in TAB_BY_KEY;

/** Changing where data goes (spreadsheet, tabs, schedule) is a provincial decision. */
export const SHEET_CONFIG_ROLES = ["super_admin", "provincial_admin"];
/** Running a sync: finance administrators may only run the finance tabs. */
export const canSyncTab = (role: string, key: string) => {
  if (!isTabKey(key)) return false;
  if (SHEET_CONFIG_ROLES.includes(role)) return true;
  return role === "finance_admin" && TAB_BY_KEY[key].group === "finance";
};
export const BAD_TAB_CHARS = /[\[\]*?:\\\/]/;
