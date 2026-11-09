/** Current Lagos date parts (UTC+1, no daylight saving). */
export function lagosParts(now: Date) {
  const l = new Date(now.getTime() + 3600_000);
  return { year: l.getUTCFullYear(), month: l.getUTCMonth() + 1, dayOfMonth: l.getUTCDate(), day: l.toISOString().slice(0, 10) };
}
