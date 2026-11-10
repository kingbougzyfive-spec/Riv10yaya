/** Reporting periods are calendar months. Lagos is fixed UTC+1 (no daylight saving). */
export const periodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodLabel = (year: number, month: number) => `${NAMES[month - 1]} ${year}`;
/** The report and remittance for month M are due on the 10th of the following month (00:00 Lagos). */
export function periodDue(year: number, month: number): Date {
  const y = month === 12 ? year + 1 : year, m = month === 12 ? 1 : month + 1;
  return new Date(Date.UTC(y, m - 1, 10, 0, 0, 0) - 3600_000);
}
export const validPeriod = (year: unknown, month: unknown) => Number.isInteger(year) && Number.isInteger(month) && (month as number) >= 1 && (month as number) <= 12 && (year as number) >= 2000 && (year as number) <= 2200;
