import { google } from "googleapis";
import { getCurrentMonthData } from "./sheetsClient";
import { parseServiceAccountJson } from "./serviceAccount";


export const CASH_FLOW_SPREADSHEET_ID = "1Rqryf8KkhvbZARkVyq3oRcS16hfbatZ8J12yzPJ3BcE";


const CASH_FLOW_BRANCHES = [
  { branch: "فرع جدة", sheetName: "فرع جدة" },
  { branch: "فرع الدمام", sheetName: "فرع الدمام" },
  { branch: "فرع الرياض", sheetName: "فرع الرياض" },
  { branch: "فرع المدينة", sheetName: "فرع المدينة" },
] as const;


export type CashFlowFilters = {
  branch?: string;
  startTs?: number;
  endTs?: number;
  search?: string;
};


export type CashFlowRow = {
  id: string;
  branch: string;
  date: string;
  dateTs: number;
  description: string;
  expense: number;
  income: number;
  balance: number;
};


export type CashFlowData = {
  rows: CashFlowRow[];
  balances: Array<{ branch: string; balance: number }>;
  totalExpense: number;
  totalIncome: number;
};
