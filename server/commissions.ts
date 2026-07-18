import type { CommissionRate, InsertCommissionRate } from "../drizzle/schema";
import { commissionRates } from "../drizzle/schema";
import { getDb } from "./db";

export type CommissionRow = {
  employee?: string | null;
  amount: number;
  branch?: string | null;
};

export type CommissionReportEntry = {
  id: number;
  employeeName: string;
  rate: number;
  isActive: number;
  isGlobalManager: boolean;
  totalWithTax: number;
  taxAmount: number;
  amountAfterTax: number;
  commissionAmount: number;
};

export type CommissionReportPayload = {
  month: string;
  monthYear: string;
  report: CommissionReportEntry[];
  totalCommission: number;
};

const DEFAULT_COMMISSION_RATES: Array<Omit<InsertCommissionRate, "id" | "createdAt" | "updatedAt">> = [
  { employeeName: "المدير العام", rate: "2.00", isActive: 1, isGlobalManager: 1 },
  { employeeName: "عبدالله", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "مصلاح", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "ريان", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "عبدالرحمن", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "خالد السلمي", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "مصطفى", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "عبدالله الدرعمي", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "الشاذلي", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "محمد", rate: "2.00", isActive: 1, isGlobalManager: 0 },
  { employeeName: "سارة", rate: "2.00", isActive: 1, isGlobalManager: 0 },
];

function roundCurrency(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function buildCommissionReport({
  rows,
  rates,
  month,
  monthYear,
  employeeName,
  branch,
  employeeAliases = {},
  taxRate = 15,
}: {
  rows: CommissionRow[];
  rates: CommissionRate[];
  month: string;
  monthYear: string;
  employeeName?: string;
  branch?: string;
  employeeAliases?: Record<string, string>;
  taxRate?: number;
}): CommissionReportPayload {
  const filteredRows = branch && branch !== "all"
    ? rows.filter((row) => row.branch === branch)
    : rows;

  const salesMap: Record<string, number> = {};
  const totalSales = filteredRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);

  for (const row of filteredRows) {
    const employeeValue = row.employee?.trim();
    if (!employeeValue || employeeValue === "-" || employeeValue === "" || employeeValue === "لا يوجد") continue;
    const realName = employeeAliases[employeeValue] ?? employeeValue;
    salesMap[realName] = (salesMap[realName] ?? 0) + (row.amount ?? 0);
  }

  const report = rates
    .filter((rate) => Number(rate.isActive ?? 1) !== 0)
    .filter((rate) => {
      if (!employeeName || employeeName === "all") return true;
      return rate.employeeName === employeeName;
    })
    .map((rate) => {
      const isGlobal = Number(rate.isGlobalManager ?? 0) === 1;
      const totalWithTax = isGlobal ? totalSales : (salesMap[rate.employeeName] ?? 0);
      const taxAmount = roundCurrency(totalWithTax / (1 + taxRate / 100) * (taxRate / 100));
      const amountAfterTax = roundCurrency(totalWithTax - taxAmount);
      const commissionRate = parseFloat(String(rate.rate ?? 0));
      const commissionAmount = roundCurrency(amountAfterTax * commissionRate / 100);

      return {
        id: rate.id,
        employeeName: rate.employeeName,
        rate: commissionRate,
        isActive: Number(rate.isActive ?? 1),
        isGlobalManager: isGlobal,
        totalWithTax,
        taxAmount,
        amountAfterTax,
        commissionAmount,
      };
    });

  return {
    month,
    monthYear,
    report,
    totalCommission: roundCurrency(report.reduce((sum, entry) => sum + entry.commissionAmount, 0)),
  };
}

export async function ensureCommissionRatesSeeded() {
  const db = await getDb();
  if (!db) return [] as CommissionRate[];

  const existing = await db.select().from(commissionRates).limit(1);
  if (existing.length > 0) {
    return db.select().from(commissionRates).orderBy(commissionRates.id);
  }

  await db.insert(commissionRates).values(DEFAULT_COMMISSION_RATES as InsertCommissionRate[]);
  return db.select().from(commissionRates).orderBy(commissionRates.id);
}
