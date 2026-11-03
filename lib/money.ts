/** Money is stored as integer kobo. Percentages as basis points (40% = 4000). Never floats. */
export const toKobo = (naira: number | string): number => Math.round(Number(naira) * 100);

export const formatNaira = (kobo: number): string =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format((kobo || 0) / 100);

/** Required remittance = offering × percent, rounded to the nearest kobo. */
export const remittanceKobo = (offeringKobo: number, percentBp: number): number => Math.round((offeringKobo * percentBp) / 10000);

export const bpToPercent = (bp: number) => bp / 100;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
