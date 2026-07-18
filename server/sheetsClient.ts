import { google } from "googleapis";
import { and, eq, gte, lt } from "drizzle-orm";
import { receipts, type InsertReceipt } from "../drizzle/schema";
import { getDb, bulkInsertReceipts } from "./db";

// ===== خريطة الشهور العربية =====
const ARABIC_MONTHS: Record<number, string> = {
  1: "يناير",
  2: "فبراير",
  3: "مارس",
  4: "أبريل",
  5: "مايو",
  6: "يونيو",
  7: "يوليو",
  8: "أغسطس",
  9: "سبتمبر",
  10: "أكتوبر",
  11: "نوفمبر",
  12: "ديسمبر",
};

export const ARABIC_MONTHS_MAP = ARABIC_MONTHS;

/** استخراج اسم الشهر الحالي بالعربية */
export function getCurrentArabicMonth(): string {
  const month = new Date().getMonth() + 1; // 1-12
  return ARABIC_MONTHS[month] ?? "يناير";
}

/** استخراج اسم الشهر بالعربية من timestamp */
export function getArabicMonthFromTs(ts: number): string {
  const month = new Date(ts).getMonth() + 1;
  return ARABIC_MONTHS[month] ?? "يناير";
}

/** تحويل اسم الشهر العربي إلى رقمه (1-12) */
export function arabicMonthToNum(name: string): number {
  const entry = Object.entries(ARABIC_MONTHS).find(([, v]) => v === name);
  return entry ? parseInt(entry[0]) : 0;
}

// ===== نوع MonthYear الموحّد =====
// الشكل: "يوليو-2026" — يُستخدم في كل مكان بدلاً من اسم الشهر وحده
export type MonthYear = string; // "شهر-سنة" مثلاً "يوليو-2026"

export function makeMonthYear(month: string, year: number): MonthYear {
  return `${month}-${year}`;
}

export function parseMonthYear(my: MonthYear): { month: string; monthNum: number; year: number } | null {
  const parts = my.split("-");
  if (parts.length < 2) return null;
  const year = parseInt(parts[parts.length - 1]);
  const month = parts.slice(0, -1).join("-");
  const monthNum = arabicMonthToNum(month);
  if (!monthNum || isNaN(year)) return null;
  return { month, monthNum, year };
}

/** الشهر والسنة الحاليين */
export function getCurrentMonthYear(): MonthYear {
  const now = new Date();
  return makeMonthYear(ARABIC_MONTHS[now.getMonth() + 1], now.getFullYear());
}

// ===== إعدادات الفروع الأربعة =====
export const SHEETS_CONFIG = [
  {
    branch: "جدة",
    spreadsheetId: "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk",
    colMap: { receiptNo: 1, date: 2, customerName: 3, service: 4, amount: 5, paymentMethod: 6, notes: 7, employee: 8 },
    dataStartRow: 5,
    defaultEmployee: "",
  },
  {
    branch: "الدمام",
    spreadsheetId: "1jmamIOkb2_1ZnL0_M6fQJBaSBsyiy-mkACOhs6F30T8",
    colMap: { receiptNo: 1, date: 2, customerName: 3, service: 4, amount: 5, paymentMethod: 6, notes: 7, employee: -1 },
    dataStartRow: 5,
    defaultEmployee: "موظف الدمام",
  },
  {
    branch: "الرياض",
    spreadsheetId: "1WaOuBMdL42H-x_iGlaJeRgghxYWU7AxaGM7CZrVF1-Y",
    colMap: { receiptNo: 1, date: 2, customerName: 3, service: 4, amount: 5, paymentMethod: 6, employee: 7, notes: 8 },
    dataStartRow: 5,
    defaultEmployee: "",
  },
  {
    branch: "المدينة",
    spreadsheetId: "1RAVd4h1fxr-i4Bwlw7m867JWsnWvLU0uw7e0WKTOoR4",
    colMap: { receiptNo: 1, date: 2, customerName: 3, service: 4, amount: 5, paymentMethod: 6, employee: 7, notes: 8 },
    dataStartRow: 5,
    defaultEmployee: "",
  },
];

export type SheetRow = {
  branch: string;
  sheetName: string;
  receiptNo: string;
  date: string;
  dateTs: number;
  customerName: string;
  service: string;
  amount: number;
  paymentMethod: string;
  employee: string;
  notes: string;
};

export type NewReceipt = {
  branch: string;
  date: string;
  customerName: string;
  service: string;
  amount: number;
  paymentMethod: string;
  employee: string;
  notes: string;
};

/** Convert a database receipt to the shape consumed by the existing dashboard. */
function receiptToSheetRow(row: typeof receipts.$inferSelect): SheetRow {
  return {
    branch: row.branch,
    sheetName: "",
    receiptNo: row.receiptNo ?? "",
    date: new Date(row.receiptDate).toISOString().slice(0, 10),
    dateTs: row.receiptDate,
    customerName: row.customerName,
    service: row.service,
    amount: Number(row.amount),
    paymentMethod: row.paymentMethod,
    employee: row.employee ?? "لا يوجد",
    notes: row.notes ?? "",
  };
}

function monthRange(monthYear?: MonthYear) {
  if (!monthYear) return undefined;
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return undefined;
  const start = Date.UTC(parsed.year, parsed.monthNum - 1, 1);
  const end = Date.UTC(parsed.year, parsed.monthNum, 1);
  return { start, end };
}

/**
 * Application reads always come from MySQL. Google Sheets is only used by the
 * explicit synchronisation functions below, never by a manager opening a page.
 */
async function getAllBranchesDataFromDatabase(monthYear?: MonthYear): Promise<SheetRow[] | null> {
  const db = await getDb();
  if (!db) return null;
  const range = monthRange(monthYear);
  const conditions = range
    ? and(gte(receipts.receiptDate, range.start), lt(receipts.receiptDate, range.end))
    : undefined;
  const rows = conditions
    ? await db.select().from(receipts).where(conditions)
    : await db.select().from(receipts);
  return rows.map(receiptToSheetRow).sort((a, b) => b.dateTs - a.dateTs);
}

async function getAvailableMonthYearsFromDatabase(): Promise<MonthYear[] | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ receiptDate: receipts.receiptDate }).from(receipts);
  const periods = new Set<MonthYear>();
  for (const row of rows) {
    const date = new Date(row.receiptDate);
    periods.add(makeMonthYear(ARABIC_MONTHS[date.getUTCMonth() + 1], date.getUTCFullYear()));
  }
  return [...periods].sort((a, b) => {
    const pa = parseMonthYear(a)!;
    const pb = parseMonthYear(b)!;
    return pb.year - pa.year || pb.monthNum - pa.monthNum;
  });
}

// ===== تحويل التواريخ =====
function parseDateToTs(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const s = raw.trim();

  // تنسيق ISO: 2026-06-08 أو 2026/06/08
  const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // تنسيق يوم/شهر/سنة: 08/06/2026 أو 8-6-2026
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    const d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // تنسيق يوم/شهر/سنة بسنتين: 08/06/26
  const dmy2 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
  if (dmy2) {
    const year = +dmy2[3] + 2000;
    const d = new Date(Date.UTC(year, +dmy2[2] - 1, +dmy2[1]));
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // تنسيق نصي عربي: 8 يونيو 2026 أو يونيو 8، 2026
  const ARABIC_MONTH_NUMS: Record<string, number> = {
    "يناير":1, "جانفي":1, "جانوار":1,
    "فبراير":2, "فيفري":2,
    "مارس":3,
    "أبريل":4, "ابريل":4, "نيسان":4,
    "مايو":5, "ماي":5,
    "يونيو":6, "جوان":6, "حزيران":6,
    "يوليو":7, "جويلية":7, "تموز":7,
    "أغسطس":8, "اغسطس":8, "آب":8,
    "سبتمبر":9, "أيلول":9,
    "أكتوبر":10, "اكتوبر":10, "تشرين":10,
    "نوفمبر":11,
    "ديسمبر":12,
  };
  const arabicDate = s.match(/(\d{1,2})\s*([\u0600-\u06ff]+)\s*(\d{4})/) ||
                     s.match(/([\u0600-\u06ff]+)\s*(\d{1,2})[,،]?\s*(\d{4})/);
  if (arabicDate) {
    const parts = arabicDate.slice(1);
    let day: number, monthName: string, year: number;
    if (/\d/.test(parts[0])) { day = +parts[0]; monthName = parts[1]; year = +parts[2]; }
    else { monthName = parts[0]; day = +parts[1]; year = +parts[2]; }
    const mNum = ARABIC_MONTH_NUMS[monthName.trim()];
    if (mNum) {
      const d = new Date(Date.UTC(year, mNum - 1, day));
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  // Google Sheets serial number (رقم تسلسلي)
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000 && serial < 100000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // محاولة أخيرة باستخدام Date.parse
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? 0 : fallback.getTime();
}

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = raw.replace(/[,،\s]/g, "").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ===== كاش ذكي =====
type CacheEntry = { data: SheetRow[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<SheetRow[]>>();

function getCacheTTL(sheetName: string): number {
  const current = getCurrentArabicMonth();
  return sheetName === current
    ? 60 * 1000
    : 30 * 60 * 1000;
}

// ===== المصادقة =====
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// ===== جلب أسماء التبويبات =====
async function getSheetNames(spreadsheetId: string): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter(Boolean);
}

/** جلب أسماء الأشهر العربية المتاحة من أول فرع (public) */
export async function getSheetNamesPublic(): Promise<string[]> {
  const arabicMonths = Object.values(ARABIC_MONTHS);
  const names = await getSheetNames(SHEETS_CONFIG[0].spreadsheetId);
  return names.filter((n) => arabicMonths.includes(n));
}

// ===== قراءة بيانات تبويب واحد =====
async function fetchSheetRows(
  config: (typeof SHEETS_CONFIG)[number],
  sheetName: string
): Promise<SheetRow[]> {
  const cacheKey = `${config.spreadsheetId}:${sheetName}`;
  const cached = cache.get(cacheKey);
  const ttl = getCacheTTL(sheetName);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached.data;
  }

  const existing = inflightRequests.get(cacheKey);
  if (existing) return existing;

  const fetchPromise = (async () => {
    try {
      const auth = getAuth();
      const sheets = google.sheets({ version: "v4", auth });

      let responseData: any = null;
      const maxRetries = 4;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.spreadsheetId,
            range: `${sheetName}!A${config.dataStartRow}:K1000`,
            valueRenderOption: "FORMATTED_VALUE",
            dateTimeRenderOption: "FORMATTED_STRING",
          });
          responseData = res.data;
          break;
        } catch (err: any) {
          const status = err?.response?.status ?? err?.code;
          const isRateLimit = status === 429 || status === 403 ||
            (err?.message ?? "").toLowerCase().includes("rate") ||
            (err?.message ?? "").toLowerCase().includes("quota");
          if (isRateLimit && attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.warn(`[Sheets] Rate limit hit for ${config.branch}/${sheetName}, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            throw err;
          }
        }
      }

      const rawRows: any[] = (responseData?.values ?? []);
      const { colMap } = config;

      const rows: SheetRow[] = rawRows
        .filter((row) => {
          const receiptRaw = (row[colMap.receiptNo] ?? "").toString().trim();
          const dateRaw    = (row[colMap.date] ?? "").toString().trim();
          const amountRaw  = (row[colMap.amount] ?? "").toString().trim();
          if (!receiptRaw || !dateRaw || !amountRaw) return false;
          return true;
        })
        .map((row) => {
          const get = (idx: number) => (idx >= 0 ? (row[idx] ?? "").toString().trim() : "");
          const dateRaw = get(colMap.date);
          const employeeRaw = get(colMap.employee);
          // إذا لم يوجد عمود الموظف أو كان فارغاً → "لا يوجد"
          const employee = employeeRaw || (config as any).defaultEmployee || "لا يوجد";
          return {
            branch: config.branch,
            sheetName,
            receiptNo: get(colMap.receiptNo),
            date: dateRaw,
            dateTs: parseDateToTs(dateRaw),
            customerName: get(colMap.customerName),
            service: get(colMap.service),
            amount: parseAmount(get(colMap.amount)),
            paymentMethod: get(colMap.paymentMethod),
            employee,
            notes: get(colMap.notes),
          };
        });

      cache.set(cacheKey, { data: rows, fetchedAt: Date.now() });
      return rows;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ===== كاش لأول صف من كل تبويب (لتحديد السنة بسرعة) =====
type TabYearCache = { year: number | null; fetchedAt: number };
const tabYearCache = new Map<string, TabYearCache>();
const TAB_YEAR_CACHE_TTL = 60 * 60 * 1000; // ساعة واحدة

/** قراءة أول صف بيانات من تبويب لمعرفة سنته — خفيف جداً (صف واحد فقط) */
async function getTabYear(
  config: (typeof SHEETS_CONFIG)[number],
  sheetName: string
): Promise<number | null> {
  const cacheKey = `year:${config.spreadsheetId}:${sheetName}`;
  const cached = tabYearCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TAB_YEAR_CACHE_TTL) {
    return cached.year;
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    // نقرأ فقط الصف الأول من البيانات (صف واحد)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${sheetName}!A${config.dataStartRow}:K${config.dataStartRow + 5}`,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const rows: any[] = res.data.values ?? [];
    // نبحث عن أول صف يحتوي على تاريخ قابل للتحليل
    for (const row of rows) {
      const dateRaw = (row[config.colMap.date] ?? "").toString().trim();
      if (!dateRaw) continue;
      const ts = parseDateToTs(dateRaw);
      if (ts > 0) {
        const year = new Date(ts).getUTCFullYear();
        tabYearCache.set(cacheKey, { year, fetchedAt: Date.now() });
        return year;
      }
    }
    // لا يوجد تاريخ قابل للتحليل في أول صفوف
    tabYearCache.set(cacheKey, { year: null, fetchedAt: Date.now() });
    return null;
  } catch {
    return null;
  }
}

// ===== جلب كل تبويبات فرع واحد (الاعتماد على التاريخ الفعلي لا على اسم التبويب) =====
async function fetchAllTabsForBranch(
  config: (typeof SHEETS_CONFIG)[number],
  targetYear?: number
): Promise<SheetRow[]> {
  const year = targetYear ?? new Date().getFullYear();
  const allNames = await getSheetNames(config.spreadsheetId);

  // الخطوة 1: قراءة أول صف من كل تبويب لمعرفة سنته (بالتوازي، خفيف جداً)
  const yearChecks = await Promise.all(
    allNames.map(async (name) => ({
      name,
      tabYear: await getTabYear(config, name).catch(() => null),
    }))
  );

  // الخطوة 2: نختار فقط التبويبات التي سنتها تطابق السنة المطلوبة
  // التبويبات التي لا يوجد فيها تاريخ قابل للتحليل تُتجاهل
  const relevantNames = yearChecks
    .filter(({ tabYear }) => tabYear === year)
    .map(({ name }) => name);

  console.log(
    `[Sheets] ${config.branch}: ${allNames.length} تبويب إجمالاً، ` +
    `${relevantNames.length} تحتوي على بيانات ${year} (حسب التاريخ الفعلي): [${relevantNames.join(", ")}]`
  );

  // الخطوة 3: قراءة التبويبات ذات الصلة كاملاً
  const results = await Promise.all(
    relevantNames.map((name) => fetchSheetRows(config, name).catch(() => [] as SheetRow[]))
  );
  return results.flat();
}

// ===== جلب بيانات الشهر الحالي من جميع الفروع =====
async function getCurrentMonthDataFromSheets(): Promise<SheetRow[]> {
  const now = new Date();
  const targetMonthNum = now.getUTCMonth() + 1;
  const targetYear = now.getUTCFullYear();

  const allRows: SheetRow[] = [];
  await Promise.all(
    SHEETS_CONFIG.map(async (config) => {
      try {
        // تمرير السنة لقراءة تبويبات السنة المطلوبة فقط
        const rows = await fetchAllTabsForBranch(config, targetYear);
        for (const r of rows) {
          if (r.dateTs > 0) {
            const d = new Date(r.dateTs);
            if (d.getUTCMonth() + 1 === targetMonthNum && d.getUTCFullYear() === targetYear) {
              allRows.push(r);
            }
          }
        }
      } catch (err) {
        console.error(`[Sheets] Error fetching ${config.branch}:`, err);
      }
    })
  );

  allRows.sort((a, b) => b.dateTs - a.dateTs);
  return allRows;
}

// ===== جلب بيانات شهر+سنة محدد من جميع الفروع =====
// يقرأ تبويبات السنة المطلوبة فقط ويفلتر بالتاريخ الفعلي — يجمع البيانات حتى لو موزعة على أكثر من تبويب
async function getAllBranchesDataFromSheets(monthYearFilter?: MonthYear): Promise<SheetRow[]> {
  const allRows: SheetRow[] = [];

  // تحليل الفلتر
  let targetMonthNum: number | null = null;
  let targetYear: number | null = null;

  if (monthYearFilter) {
    const parsed = parseMonthYear(monthYearFilter);
    if (parsed) {
      targetMonthNum = parsed.monthNum;
      targetYear = parsed.year;
    } else {
      // دعم الشكل القديم (اسم شهر فقط بدون سنة) للتوافق مع الكود القديم
      const monthNum = arabicMonthToNum(monthYearFilter);
      if (monthNum > 0) {
        targetMonthNum = monthNum;
        const now = new Date();
        const currentMonthNum = now.getUTCMonth() + 1;
        targetYear = monthNum > currentMonthNum ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
      }
    }
  }

  // السنة المستهدفة للفلترة (للتبويبات)
  const fetchYear = targetYear ?? new Date().getFullYear();

  await Promise.all(
    SHEETS_CONFIG.map(async (config) => {
      try {
        // نقرأ تبويبات السنة المطلوبة فقط ونفلتر بالتاريخ الفعلي
        // هذا يضمن جمع البيانات حتى لو موزعة على أكثر من تبويب
        const rows = await fetchAllTabsForBranch(config, fetchYear);

        for (const r of rows) {
          if (targetMonthNum !== null && targetYear !== null) {
            if (r.dateTs > 0) {
              const d = new Date(r.dateTs);
              const rowMonth = d.getUTCMonth() + 1;
              const rowYear = d.getUTCFullYear();
              if (rowMonth === targetMonthNum && rowYear === targetYear) {
                allRows.push(r);
              }
            }
            // صفوف بدون تاريخ قابل للتحليل تُتجاهل
          } else {
            // بدون فلتر: أضف كل الصفوف ذات التاريخ الصالح
            if (r.dateTs > 0) allRows.push(r);
          }
        }
      } catch (err) {
        console.error(`[Sheets] Error fetching ${config.branch}:`, err);
      }
    })
  );

  allRows.sort((a, b) => b.dateTs - a.dateTs);
  return allRows;
}

// ===== جلب الأشهر المتاحة مع سنواتها من البيانات الفعلية =====
// يقرأ كل التبويبات ويستخرج الأشهر+السنوات الفريدة من التواريخ الفعلية
async function getAvailableMonthYearsFromSheets(): Promise<MonthYear[]> {
  const monthYearSet = new Set<string>();

  await Promise.all(
    SHEETS_CONFIG.map(async (config) => {
      try {
        // نقرأ تبويبات السنة الحالية فقط
        const currentYear = new Date().getFullYear();
        const rows = await fetchAllTabsForBranch(config, currentYear);
        for (const r of rows) {
          if (r.dateTs > 0) {
            const d = new Date(r.dateTs);
            const monthNum = d.getUTCMonth() + 1;
            const year = d.getUTCFullYear();
            const monthName = ARABIC_MONTHS[monthNum];
            if (monthName) {
              monthYearSet.add(makeMonthYear(monthName, year));
            }
          }
        }
      } catch {
        // تجاهل الأخطاء
      }
    })
  );

  // ترتيب تنازلي (الأحدث أولاً)
  return Array.from(monthYearSet).sort((a, b) => {
    const pa = parseMonthYear(a);
    const pb = parseMonthYear(b);
    if (!pa || !pb) return 0;
    if (pb.year !== pa.year) return pb.year - pa.year;
    return pb.monthNum - pa.monthNum;
  });
}

// ===== إضافة سند جديد إلى الشهر الحالي =====
/** Manager-facing requests use the database, avoiding Google API calls per page view. */
export async function getAllBranchesData(monthYearFilter?: MonthYear): Promise<SheetRow[]> {
  const localRows = await getAllBranchesDataFromDatabase(monthYearFilter);
  if (localRows !== null) return localRows;
  console.warn("[Sheets] DATABASE_URL is not configured; falling back to Google Sheets.");
  return getAllBranchesDataFromSheets(monthYearFilter);
}

export async function getCurrentMonthData(): Promise<SheetRow[]> {
  return getAllBranchesData(getCurrentMonthYear());
}

export async function getAvailableMonthYears(): Promise<MonthYear[]> {
  const localPeriods = await getAvailableMonthYearsFromDatabase();
  return localPeriods ?? getAvailableMonthYearsFromSheets();
}

/**
 * Refresh one period deliberately. This is the only path that reads Google
 * Sheets after the initial migration. It replaces that month atomically at the
 * application level, so removed or corrected rows are reflected as well.
 */
export async function syncMonthFromGoogleSheets(monthYear: MonthYear = getCurrentMonthYear()) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required before synchronising Google Sheets");
  const range = monthRange(monthYear);
  if (!range) throw new Error(`Invalid month-year: ${monthYear}`);

  const sourceRows = await getAllBranchesDataFromSheets(monthYear);
  const insertRows: InsertReceipt[] = sourceRows.map((row) => ({
    receiptNo: row.receiptNo || null,
    receiptDate: row.dateTs,
    branch: row.branch,
    customerName: row.customerName || "غير محدد",
    service: row.service || "غير محدد",
    amount: String(row.amount),
    paymentMethod: row.paymentMethod || "غير محدد",
    employee: row.employee || null,
    notes: row.notes || null,
  }));

  await db.delete(receipts).where(and(
    gte(receipts.receiptDate, range.start),
    lt(receipts.receiptDate, range.end)
  ));
  await bulkInsertReceipts(insertRows);
  clearCache();
  return { monthYear, imported: insertRows.length };
}

/**
 * One-time bootstrap for the archived tabs. Tabs are read sequentially (with a
 * short pause) to stay below Google Sheets API limits; normal page traffic does
 * not call this function. Re-running it safely replaces each imported month.
 */
export async function importHistoricalSheetsToDatabase() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required before importing Google Sheets");

  const byPeriod = new Map<MonthYear, SheetRow[]>();
  for (const config of SHEETS_CONFIG) {
    const tabNames = await getSheetNames(config.spreadsheetId);
    for (const tabName of tabNames) {
      const rows = await fetchSheetRows(config, tabName);
      for (const row of rows) {
        if (!row.dateTs) continue;
        const date = new Date(row.dateTs);
        const period = makeMonthYear(ARABIC_MONTHS[date.getUTCMonth() + 1], date.getUTCFullYear());
        byPeriod.set(period, [...(byPeriod.get(period) ?? []), row]);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  let imported = 0;
  for (const [period, rows] of byPeriod) {
    const range = monthRange(period)!;
    await db.delete(receipts).where(and(
      gte(receipts.receiptDate, range.start),
      lt(receipts.receiptDate, range.end)
    ));
    const insertRows: InsertReceipt[] = rows.map((row: SheetRow) => ({
      receiptNo: row.receiptNo || null,
      receiptDate: row.dateTs,
      branch: row.branch,
      customerName: row.customerName || "غير محدد",
      service: row.service || "غير محدد",
      amount: String(row.amount),
      paymentMethod: row.paymentMethod || "غير محدد",
      employee: row.employee || null,
      notes: row.notes || null,
    }));
    await bulkInsertReceipts(insertRows);
    imported += insertRows.length;
  }
  clearCache();
  return { periods: byPeriod.size, imported };
}

/**
 * Refresh only the mutable (current) month on a fixed cadence. Historical
 * periods are never fetched by this scheduler. It is intentionally disabled
 * until both the database URL and Google service-account JSON are configured.
 */
export function startCurrentMonthSync(intervalMs = 60 * 1000) {
  if (!process.env.DATABASE_URL || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.info("[Sheets] Automatic sync is disabled until DATABASE_URL and GOOGLE_SERVICE_ACCOUNT_JSON are configured.");
    return;
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await syncMonthFromGoogleSheets();
      console.info(`[Sheets] Synced ${result.imported} receipts for ${result.monthYear}.`);
    } catch (error) {
      console.error("[Sheets] Scheduled current-month sync failed:", error);
    } finally {
      running = false;
    }
  };

  void run();
  return setInterval(run, intervalMs);
}

export async function appendReceiptToSheet(
  branchName: string,
  receipt: NewReceipt
): Promise<{ success: boolean; receiptNo: string; sheetName: string }> {
  const config = SHEETS_CONFIG.find((c) => c.branch === branchName);
  if (!config) throw new Error(`Branch not found: ${branchName}`);

  const currentMonth = getCurrentArabicMonth();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // جلب آخر رقم سند
  let lastReceiptNo = 0;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${currentMonth}!A${config.dataStartRow}:K1000`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows: any[] = res.data.values ?? [];
    for (const row of rows) {
      const n = parseInt((row[config.colMap.receiptNo] ?? "").toString().replace(/\D/g, ""));
      if (!isNaN(n) && n > lastReceiptNo) lastReceiptNo = n;
    }
  } catch {
    lastReceiptNo = 0;
  }

  const nextReceiptNo = String(lastReceiptNo + 1);
  const row = new Array(10).fill("");
  row[config.colMap.receiptNo] = nextReceiptNo;
  row[config.colMap.date] = receipt.date;
  row[config.colMap.customerName] = receipt.customerName;
  row[config.colMap.service] = receipt.service;
  row[config.colMap.amount] = String(receipt.amount);
  row[config.colMap.paymentMethod] = receipt.paymentMethod;
  if (config.colMap.employee >= 0) row[config.colMap.employee] = receipt.employee;
  if (config.colMap.notes >= 0) row[config.colMap.notes] = receipt.notes;

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${currentMonth}!A${config.dataStartRow}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "OVERWRITE",
    requestBody: { values: [row] },
  });

  // مسح كاش الشهر الحالي لهذا الفرع
  const cacheKey = `${config.spreadsheetId}:${currentMonth}`;
  cache.delete(cacheKey);

  return { success: true, receiptNo: nextReceiptNo, sheetName: currentMonth };
}

// ===== مسح الكاش =====
export function clearCache() {
  cache.clear();
}

export function clearBranchMonthCache(branchName: string, monthName?: string) {
  const config = SHEETS_CONFIG.find((c) => c.branch === branchName);
  if (!config) return;
  const month = monthName ?? getCurrentArabicMonth();
  cache.delete(`${config.spreadsheetId}:${month}`);
}

// ===== أنواع الإحصائيات =====
export type DashboardStats = {
  totalAmount: number;
  totalCount: number;
  currentMonth: string;
  currentMonthYear: MonthYear;
  byBranch: { key: string; total: number; count: number }[];
  byPayment: { key: string; total: number; count: number }[];
  byService: { key: string; total: number; count: number }[];
  byEmployee: { key: string; total: number; count: number }[];
  timeSeries: { period: string; total: number; count: number }[];
};

export type Filters = {
  branch?: string;
  paymentMethod?: string;
  employee?: string;
  service?: string;
  startTs?: number;
  endTs?: number;
  month?: string;       // للتوافق القديم
  monthYear?: MonthYear; // الشكل الجديد "يوليو-2026"
};

function applyFilters(rows: SheetRow[], filters: Filters): SheetRow[] {
  return rows.filter((r) => {
    if (filters.branch && r.branch !== filters.branch) return false;
    if (filters.paymentMethod && r.paymentMethod !== filters.paymentMethod) return false;
    if (filters.employee && r.employee !== filters.employee) return false;
    if (filters.service && r.service !== filters.service) return false;
    if (filters.startTs && r.dateTs > 0 && r.dateTs < filters.startTs) return false;
    if (filters.endTs && r.dateTs > 0 && r.dateTs > filters.endTs) return false;
    return true;
  });
}

function groupBy(
  rows: SheetRow[],
  key: keyof SheetRow
): { key: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const k = (r[key] as string) || "غير محدد";
    const existing = map.get(k) ?? { total: 0, count: 0 };
    existing.total += r.amount;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);
}

function buildTimeSeries(
  rows: SheetRow[],
  granularity: "day" | "month"
): { period: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (!r.dateTs) continue;
    const d = new Date(r.dateTs);
    const period =
      granularity === "day"
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = map.get(period) ?? { total: 0, count: 0 };
    existing.total += r.amount;
    existing.count += 1;
    map.set(period, existing);
  }
  return Array.from(map.entries())
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function computeDashboardStats(filters: Filters): Promise<DashboardStats> {
  const now = new Date();
  const currentMonth = getCurrentArabicMonth();
  const currentMonthYear = getCurrentMonthYear();

  // تحديد الفلتر المناسب
  const effectiveMonthYear = filters.monthYear ?? (filters.month ? makeMonthYear(
    filters.month,
    arabicMonthToNum(filters.month) > (now.getUTCMonth() + 1) ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  ) : null);

  const all = await getAllBranchesData(effectiveMonthYear ?? currentMonthYear);
  const filtered = applyFilters(all, filters);
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const totalCount = filtered.length;

  const range = (filters.endTs ?? Date.now()) - (filters.startTs ?? 0);
  const granularity = range > 60 * 24 * 60 * 60 * 1000 ? "month" : "day";

  return {
    totalAmount,
    totalCount,
    currentMonth,
    currentMonthYear,
    byBranch: groupBy(filtered, "branch"),
    byPayment: groupBy(filtered, "paymentMethod"),
    byService: groupBy(filtered, "service"),
    byEmployee: groupBy(filtered.filter((r) => r.employee && r.employee !== "لا يوجد"), "employee"),
    timeSeries: buildTimeSeries(filtered, granularity),
  };
}

export async function getFilterOptions(monthYearFilter?: MonthYear): Promise<{
  branches: string[];
  paymentMethods: string[];
  employees: string[];
  services: string[];
  availableMonthYears: MonthYear[];
  currentMonthYear: MonthYear;
  currentMonth: string;
}> {
  const currentMonthYear = getCurrentMonthYear();
  const all = await getAllBranchesData(monthYearFilter ?? currentMonthYear);
  const unique = <K extends keyof SheetRow>(key: K) =>
    Array.from(new Set(all.map((r) => r[key] as string).filter(Boolean))).sort();

  // جلب الأشهر المتاحة من التواريخ الفعلية
  let availableMonthYears: MonthYear[] = [currentMonthYear];
  try {
    availableMonthYears = await getAvailableMonthYears();
    if (availableMonthYears.length === 0) availableMonthYears = [currentMonthYear];
  } catch {
    availableMonthYears = [currentMonthYear];
  }

  return {
    branches: SHEETS_CONFIG.map((c) => c.branch),
    paymentMethods: unique("paymentMethod"),
    employees: unique("employee"),
    services: unique("service"),
    availableMonthYears,
    currentMonthYear,
    currentMonth: getCurrentArabicMonth(),
  };
}
