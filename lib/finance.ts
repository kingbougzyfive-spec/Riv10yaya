import { getDb } from "./db";

export type FinanceSettings = {
  percentBp: number;
  bank: { bankName: string; accountName: string; accountNumber: string; instructions: string };
  history: { at: string; byName: string; field: string; from: string; to: string }[];
};

export const defaultFinance: FinanceSettings = {
  percentBp: 4000,
  bank: { bankName: "", accountName: "", accountNumber: "", instructions: "Pay directly into the official provincial account and upload your payment evidence." },
  history: [],
};

export async function getFinance(): Promise<FinanceSettings> {
  const { SystemConfig } = await getDb();
  const doc = await SystemConfig.findOne({ key: "finance" }).lean<any>();
  const v = doc?.value ?? {};
  return { ...defaultFinance, ...v, bank: { ...defaultFinance.bank, ...(v.bank ?? {}) }, history: v.history ?? [] };
}

export async function saveFinance(next: FinanceSettings) {
  const { SystemConfig } = await getDb();
  await SystemConfig.updateOne({ key: "finance" }, { $set: { value: next } }, { upsert: true });
}
