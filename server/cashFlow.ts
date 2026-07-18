import { google } from "googleapis";
import { getCurrentMonthData } from "./sheetsClient";

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

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function getWriteAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function riyadhDateParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    label: `${values.day}/${values.month}/${values.year}`,
  };
}

function isCashPayment(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(/[ًٌٍَُِّْ]/g, "");
  return /\u0643\u0627\u0634|\u0646\u0642\u062f/.test(normalized);
}

function parseAmount(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[,،\sر.س]/g, "")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value: unknown): { label: string; ts: number } | null {
  const label = String(value ?? "").trim();
  const match = label.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return null;
  return { label, ts: date.getTime() };
}

export async function getCashFlowData(filters: CashFlowFilters = {}): Promise<CashFlowData> {
  const auth = getAuth();
  if (!auth) {
    return { rows: [], balances: CASH_FLOW_BRANCHES.map(({ branch }) => ({ branch, balance: 0 })), totalExpense: 0, totalIncome: 0 };
  }

  const sheets = google.sheets({ version: "v4", auth });
  const responses = await Promise.all(
    CASH_FLOW_BRANCHES.map(async ({ branch, sheetName }) => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: CASH_FLOW_SPREADSHEET_ID,
        range: `'${sheetName}'!B4:F1000`,
        valueRenderOption: "FORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      });

      const parsedRows: CashFlowRow[] = [];
      for (const [index, row] of (response.data.values ?? []).entries()) {
        const parsedDate = parseDate(row[0]);
        if (!parsedDate) continue;
        parsedRows.push({
          id: `${branch}-${index + 4}`,
          branch,
          date: parsedDate.label,
          dateTs: parsedDate.ts,
          description: String(row[1] ?? "").trim(),
          expense: parseAmount(row[2]),
          income: parseAmount(row[3]),
          balance: parseAmount(row[4]),
        });
      }

      return parsedRows;
    })
  );

  const dateRows: CashFlowRow[] = responses.flat().filter((row): row is CashFlowRow =>
    (filters.startTs === undefined || row.dateTs >= filters.startTs) &&
    (filters.endTs === undefined || row.dateTs <= filters.endTs)
  );
  let rows: CashFlowRow[] = dateRows;
  if (filters.branch) rows = rows.filter(row => row.branch === filters.branch);
  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase();
    rows = rows.filter(row => `${row.branch} ${row.description}`.toLowerCase().includes(query));
  }

  rows.sort((a, b) => b.dateTs - a.dateTs || a.id.localeCompare(b.id));
  // بطاقات الرصيد تعرض آخر رصيد فعلي دائمًا، ولا تتأثر بفلاتر جدول الحركات.
  const balanceRows: CashFlowRow[] = responses.flat();
  const balances = CASH_FLOW_BRANCHES.map(({ branch }) => {
    const branchRows: CashFlowRow[] = balanceRows
      .filter((row): row is CashFlowRow => row.branch === branch)
      .sort((a, b) => b.dateTs - a.dateTs || a.id.localeCompare(b.id));
    return { branch, balance: branchRows[0]?.balance ?? 0 };
  });

  return {
    rows,
    balances,
    totalExpense: rows.reduce((total, row) => total + row.expense, 0),
    totalIncome: rows.reduce((total, row) => total + row.income, 0),
  };
}

function cashMovementDescription(row: { receiptNo: string; service: string; customerName: string }) {
  const receipt = row.receiptNo || `${row.customerName}-${row.service}`;
  return `\u0625\u064a\u0631\u0627\u062f \u0643\u0627\u0634 \u2022 \u0633\u0646\u062f: ${receipt} \u2022 ${row.service} \u2022 ${row.customerName}`;
}

/** Copy each cash receipt once into the matching branch tab in the cash-flow sheet. */
export async function syncCashMovementsToSheet() {
  const auth = getWriteAuth();
  if (!auth) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required before syncing cash totals");

  const records = await getCurrentMonthData();
  const sheets = google.sheets({ version: "v4", auth });
  const results: Array<{ branch: string; added: number }> = [];

  await Promise.all(CASH_FLOW_BRANCHES.map(async ({ branch, sheetName }) => {
    const recordBranch = branch.replace(/^\u0641\u0631\u0639\s*/, "");
    const cashRecords = records
      .filter((row) => row.branch === recordBranch)
      .filter((row) => isCashPayment(row.paymentMethod))
      .sort((a, b) => a.dateTs - b.dateTs);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CASH_FLOW_SPREADSHEET_ID,
      range: `'${sheetName}'!B4:F1000`,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const rows = response.data.values ?? [];
    const existingDescriptions = new Set(rows.map((row) => String(row[1] ?? "").trim()));
    let nextBalance = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => String(row[0] ?? "").trim())
      .at(-1)?.row[4];
    let balance = parseAmount(nextBalance);
    let added = 0;

    for (const record of cashRecords) {
      const description = cashMovementDescription(record);
      if (existingDescriptions.has(description)) continue;
      balance += Number.isFinite(record.amount) ? record.amount : 0;
      await sheets.spreadsheets.values.append({
        spreadsheetId: CASH_FLOW_SPREADSHEET_ID,
        range: `'${sheetName}'!B:F`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[riyadhDateParts(record.dateTs).label, description, 0, record.amount, balance]],
        },
      });
      existingDescriptions.add(description);
      added += 1;
    }
    results.push({ branch, added });
  }));

  return { branches: results };
}

export const cashFlowBranches = CASH_FLOW_BRANCHES.map(({ branch }) => branch);
