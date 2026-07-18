import { z } from "zod";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { ownerProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { commissionRates, type CommissionRate } from "../drizzle/schema";
import { buildCommissionReport, ensureCommissionRatesSeeded } from "./commissions";
import {
  getAllBranchesData,
  getCurrentMonthData,
  computeDashboardStats,
  getFilterOptions,
  getAvailableMonthYears,
  clearCache,
  importHistoricalSheetsToDatabase,
  syncMonthFromGoogleSheets,
  getCurrentArabicMonth,
  getCurrentMonthYear,
  makeMonthYear,
  parseMonthYear,
  arabicMonthToNum,
  SHEETS_CONFIG,
  type Filters,
  type MonthYear,
} from "./sheetsClient";
import { cashFlowBranches, getCashFlowData } from "./cashFlow";

const ARABIC_MONTHS_LIST = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * حساب نطاق المقارنة الذكي بناءً على MonthYear
 */
function getComparisonMeta(monthYear: MonthYear): {
  isCurrentMonth: boolean;
  todayDay: number;
  comparisonLabel: string;
  prevComparisonLabel: string;
  prevMonthYear: MonthYear | null;
} {
  const now = new Date();
  const currentMY = getCurrentMonthYear();
  const isCurrentMonth = monthYear === currentMY;
  const todayDay = now.getDate();

  const parsed = parseMonthYear(monthYear);
  if (!parsed) {
    return { isCurrentMonth: false, todayDay: 0, comparisonLabel: "", prevComparisonLabel: "", prevMonthYear: null };
  }

  // حساب الشهر السابق
  let prevMonthYear: MonthYear | null = null;
  if (parsed.monthNum > 1) {
    const prevMonthName = ARABIC_MONTHS_LIST[parsed.monthNum - 2];
    prevMonthYear = makeMonthYear(prevMonthName, parsed.year);
  } else {
    // يناير → ديسمبر من السنة السابقة
    prevMonthYear = makeMonthYear("ديسمبر", parsed.year - 1);
  }

  const parsedPrev = parseMonthYear(prevMonthYear);

  if (isCurrentMonth) {
    const comparisonLabel = `1 - ${todayDay} ${parsed.month} ${parsed.year}`;
    const prevComparisonLabel = parsedPrev
      ? `1 - ${todayDay} ${parsedPrev.month} ${parsedPrev.year} (نفس الفترة)`
      : "";
    return { isCurrentMonth: true, todayDay, comparisonLabel, prevComparisonLabel, prevMonthYear };
  } else {
    const comparisonLabel = `${parsed.month} ${parsed.year} كاملاً`;
    const prevComparisonLabel = parsedPrev
      ? `${parsedPrev.month} ${parsedPrev.year} كاملاً`
      : "";
    return { isCurrentMonth: false, todayDay: 0, comparisonLabel, prevComparisonLabel, prevMonthYear };
  }
}

function filterSamePeriod<T extends { dateTs: number }>(rows: T[], upToDay: number): T[] {
  return rows.filter((r) => {
    if (!r.dateTs) return true;
    const d = new Date(r.dateTs);
    return d.getDate() <= upToDay;
  });
}

const FiltersSchema = z.object({
  branch: z.string().optional(),
  paymentMethod: z.string().optional(),
  employee: z.string().optional(),
  service: z.string().optional(),
  startTs: z.number().optional(),
  endTs: z.number().optional(),
  month: z.string().optional(),       // للتوافق القديم
  monthYear: z.string().optional(),   // الشكل الجديد "يوليو-2026"
});

/** تحويل input إلى MonthYear فعّال */
function resolveMonthYear(input: { month?: string; monthYear?: string; startTs?: number; endTs?: number }): MonthYear | undefined {
  if (input.monthYear) return input.monthYear;
  if (input.month && !input.startTs && !input.endTs) {
    const now = new Date();
    const monthNum = arabicMonthToNum(input.month);
    const year = monthNum > (now.getUTCMonth() + 1) ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    return makeMonthYear(input.month, year);
  }
  return undefined;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== بيانات Google Sheets =====
  sheets: router({
    /** الشهر الحالي بالعربية */
    currentMonth: publicProcedure.query(() => ({
      month: getCurrentArabicMonth(),
      monthYear: getCurrentMonthYear(),
      branches: SHEETS_CONFIG.map((c) => c.branch),
    })),

    /** إحصائيات لوحة التحكم */
    dashboardStats: ownerProcedure
      .input(FiltersSchema)
      .query(async ({ input }) => {
        const effectiveMonthYear = resolveMonthYear(input);
        const filters: Filters = {
          branch: input.branch,
          paymentMethod: input.paymentMethod,
          employee: input.employee,
          service: input.service,
          startTs: input.startTs,
          endTs: input.endTs,
          monthYear: effectiveMonthYear,
        };
        return computeDashboardStats(filters);
      }),

    /** بيانات الشهر الحالي فقط */
    currentMonthData: protectedProcedure.query(async () => {
      const rows = await getCurrentMonthData();
      return {
        records: rows,
        total: rows.length,
        totalAmount: rows.reduce((s, r) => s + r.amount, 0),
        month: getCurrentArabicMonth(),
        monthYear: getCurrentMonthYear(),
      };
    }),

    /** جلب السجلات مع فلاتر كاملة */
    records: protectedProcedure
      .input(
        FiltersSchema.extend({
          search: z.string().optional(),
          receiptNoFilter: z.string().optional(),
          customerFilter: z.string().optional(),
          amountMin: z.number().optional(),
          amountMax: z.number().optional(),
          page: z.number().default(1),
          pageSize: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        // إذا كان هناك فترة زمنية مخصصة (startTs/endTs) نجلب كل البيانات ونفلتر
        // وإلا نجلب الشهر المحدد فقط
        let effectiveMonthYear: MonthYear | undefined;
        if (!input.startTs && !input.endTs) {
          effectiveMonthYear = resolveMonthYear(input) ?? getCurrentMonthYear();
        }

        const all = await getAllBranchesData(effectiveMonthYear);

        let filtered = all;
        if (input.branch) filtered = filtered.filter((r) => r.branch === input.branch);
        if (input.paymentMethod) filtered = filtered.filter((r) => r.paymentMethod === input.paymentMethod);
        if (input.employee) filtered = filtered.filter((r) => r.employee === input.employee);
        if (input.service) filtered = filtered.filter((r) => r.service === input.service);
        if (input.startTs) filtered = filtered.filter((r) => !r.dateTs || r.dateTs >= input.startTs!);
        if (input.endTs) filtered = filtered.filter((r) => !r.dateTs || r.dateTs <= input.endTs!);
        if (input.receiptNoFilter) {
          const q = input.receiptNoFilter.toLowerCase();
          filtered = filtered.filter((r) => String(r.receiptNo ?? "").toLowerCase().includes(q));
        }
        if (input.customerFilter) {
          const q = input.customerFilter.toLowerCase();
          filtered = filtered.filter((r) => (r.customerName ?? "").toLowerCase().includes(q));
        }
        if (input.amountMin !== undefined) filtered = filtered.filter((r) => r.amount >= input.amountMin!);
        if (input.amountMax !== undefined) filtered = filtered.filter((r) => r.amount <= input.amountMax!);
        if (input.search) {
          const q = input.search.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.customerName.toLowerCase().includes(q) ||
              r.service.toLowerCase().includes(q) ||
              r.receiptNo.includes(q) ||
              r.employee.toLowerCase().includes(q) ||
              r.notes.toLowerCase().includes(q)
          );
        }

        const total = filtered.length;
        const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
        const start = (input.page - 1) * input.pageSize;
        const page = filtered.slice(start, start + input.pageSize);

        return {
          records: page,
          total,
          totalAmount,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
          month: input.month ?? getCurrentArabicMonth(),
          monthYear: effectiveMonthYear ?? getCurrentMonthYear(),
        };
      }),

    /** خيارات الفلاتر */
    filterOptions: protectedProcedure
      .input(z.object({ month: z.string().optional(), monthYear: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const my = input?.monthYear ?? (input?.month ? resolveMonthYear({ month: input.month }) : undefined);
        return getFilterOptions(my);
      }),

    /** مقارنة الفروع */
    branchComparison: ownerProcedure
      .input(z.object({ monthYear: z.string().optional(), month: z.string().optional() }))
      .query(async ({ input }) => {
        const currentMY: MonthYear = input.monthYear ?? resolveMonthYear({ month: input.month }) ?? getCurrentMonthYear();
        const meta = getComparisonMeta(currentMY);
        const prevMY = meta.prevMonthYear;

        const [currentRows, prevRows] = await Promise.all([
          getAllBranchesData(currentMY),
          prevMY ? getAllBranchesData(prevMY) : Promise.resolve([]),
        ]);

        const filteredPrevRows = meta.isCurrentMonth
          ? filterSamePeriod(prevRows, meta.todayDay)
          : prevRows;

        const branches = SHEETS_CONFIG.map((c) => c.branch);
        const parsedCurrent = parseMonthYear(currentMY);
        const parsedPrev = prevMY ? parseMonthYear(prevMY) : null;

        const comparison = branches.map((branch) => {
          const curr = currentRows.filter((r) => r.branch === branch);
          const prev = filteredPrevRows.filter((r) => r.branch === branch);
          const currTotal = curr.reduce((s, r) => s + r.amount, 0);
          const prevTotal = prev.reduce((s, r) => s + r.amount, 0);
          const growth = prevTotal === 0
            ? (currTotal > 0 ? 100 : 0)
            : Math.round(((currTotal - prevTotal) / prevTotal) * 100);
          return { branch, currentTotal: currTotal, currentCount: curr.length, prevTotal, prevCount: prev.length, growth };
        });

        return {
          currentMonth: parsedCurrent?.month ?? "",
          currentMonthYear: currentMY,
          prevMonth: parsedPrev?.month ?? "",
          prevMonthYear: prevMY ?? "",
          isPartialComparison: meta.isCurrentMonth,
          comparisonLabel: meta.comparisonLabel,
          prevComparisonLabel: meta.prevComparisonLabel,
          comparison,
          totalCurrent: comparison.reduce((s, b) => s + b.currentTotal, 0),
          totalPrev: comparison.reduce((s, b) => s + b.prevTotal, 0),
        };
      }),

    /** تقرير النمو */
    growthReport: ownerProcedure
      .input(z.object({
        selectedMonth: z.string().optional(),
        selectedMonthYear: z.string().optional(),
        branch: z.string().optional(),
      }))
      .query(async ({ input }) => {
        // جلب الأشهر المتاحة مع سنواتها
        let availableMonthYears: MonthYear[] = [getCurrentMonthYear()];
        try {
          availableMonthYears = await getAvailableMonthYears();
          if (availableMonthYears.length === 0) availableMonthYears = [getCurrentMonthYear()];
        } catch {
          availableMonthYears = [getCurrentMonthYear()];
        }

        const currentMY: MonthYear = input.selectedMonthYear
          ?? resolveMonthYear({ month: input.selectedMonth })
          ?? getCurrentMonthYear();

        const meta = getComparisonMeta(currentMY);
        const prevMY = meta.prevMonthYear;
        const prevMonthExists = prevMY ? availableMonthYears.includes(prevMY) : false;

        const [currentRows, prevRows] = await Promise.all([
          getAllBranchesData(currentMY),
          prevMonthExists && prevMY ? getAllBranchesData(prevMY) : Promise.resolve([]),
        ]);

        const filteredPrevRows = meta.isCurrentMonth
          ? filterSamePeriod(prevRows, meta.todayDay)
          : prevRows;

        const filterBranch = (rows: typeof currentRows) =>
          input.branch && input.branch !== "all"
            ? rows.filter((r) => r.branch === input.branch)
            : rows;

        const filteredCurrent = filterBranch(currentRows);
        const filteredPrev = filterBranch(filteredPrevRows);
        const branches = SHEETS_CONFIG.map((c) => c.branch);

        const branchDetails = branches.map((branch) => {
          const curr = filteredCurrent.filter((r) => r.branch === branch);
          const prev = filteredPrev.filter((r) => r.branch === branch);
          const currTotal = curr.reduce((s, r) => s + r.amount, 0);
          const prevTotal = prev.reduce((s, r) => s + r.amount, 0);
          const netChange = currTotal - prevTotal;
          const growthPct = prevTotal === 0
            ? (currTotal > 0 ? 100 : 0)
            : Math.round(((currTotal - prevTotal) / prevTotal) * 1000) / 10;
          return { branch, currTotal, prevTotal, netChange, growthPct };
        });

        const totalCurrent = filteredCurrent.reduce((s, r) => s + r.amount, 0);
        const totalPrev = filteredPrev.reduce((s, r) => s + r.amount, 0);
        const totalNetChange = totalCurrent - totalPrev;
        const totalGrowthPct = totalPrev === 0
          ? (totalCurrent > 0 ? 100 : 0)
          : Math.round(((totalCurrent - totalPrev) / totalPrev) * 1000) / 10;

        // منحنى تطور الإيرادات: كل الأشهر المتاحة مع سنواتها
        const trendData = await Promise.all(
          availableMonthYears.map(async (my) => {
            const parsed = parseMonthYear(my);
            const rows = filterBranch(await getAllBranchesData(my).catch(() => []));
            return {
              month: parsed ? `${parsed.month} ${parsed.year}` : my,
              monthYear: my,
              total: rows.reduce((s, r) => s + r.amount, 0),
            };
          })
        );
        // ترتيب تصاعدي (الأقدم أولاً) للرسم البياني
        trendData.sort((a, b) => {
          const pa = parseMonthYear(a.monthYear);
          const pb = parseMonthYear(b.monthYear);
          if (!pa || !pb) return 0;
          if (pa.year !== pb.year) return pa.year - pb.year;
          return pa.monthNum - pb.monthNum;
        });

        const parsedCurrent = parseMonthYear(currentMY);
        const parsedPrev = prevMY ? parseMonthYear(prevMY) : null;

        return {
          currentMonth: parsedCurrent?.month ?? "",
          currentMonthYear: currentMY,
          prevMonth: parsedPrev?.month ?? "",
          prevMonthYear: prevMY ?? "",
          prevMonthExists,
          isPartialComparison: meta.isCurrentMonth,
          comparisonLabel: meta.comparisonLabel,
          prevComparisonLabel: meta.prevComparisonLabel,
          availableMonthYears,
          branchDetails,
          totalCurrent,
          totalPrev,
          totalNetChange,
          totalGrowthPct,
          trendData,
        };
      }),

    /** مسح الكاش */
    clearCache: ownerProcedure.mutation(() => {
      clearCache();
      return { success: true };
    }),

    /** حركة الكاش من الشيت المخصص للفروع */
    cashFlow: protectedProcedure
      .input(z.object({
        branch: z.string().optional(),
        startTs: z.number().optional(),
        endTs: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => ({
        ...(await getCashFlowData(input ?? {})),
        branches: cashFlowBranches,
      })),

    /** Refreshes one selected period. Restricted to the owner/admin. */
    syncMonth: ownerProcedure
      .input(z.object({ monthYear: z.string().optional() }))
      .mutation(async ({ input }) => syncMonthFromGoogleSheets(input.monthYear ?? getCurrentMonthYear())),

    /** One-time, rate-limited import for all archived Google Sheets tabs. */
    importHistory: ownerProcedure.mutation(() => importHistoricalSheetsToDatabase()),
  }),

  // ===== عمولات الموظفين =====
  commissions: router({
    /** جلب كل نسب العمولات */
    getRates: ownerProcedure.query(async () => {
      const rates = await ensureCommissionRatesSeeded();
      return rates as CommissionRate[];
    }),

    /** جلب تقرير العمولات لشهر محدد مع فلاتر اختيارية */
    getReport: ownerProcedure
      .input(z.object({
        month: z.string().optional(),
        monthYear: z.string().optional(),
        branch: z.string().optional(),
        employeeName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const targetMY: MonthYear = input.monthYear
          ?? resolveMonthYear({ month: input.month })
          ?? getCurrentMonthYear();
        const parsedMY = parseMonthYear(targetMY);
        const rows = await getAllBranchesData(targetMY);

        const employeeAliases: Record<string, string> = {
          "موظف الدمام": "الشاذلي",
        };

        const rates = await ensureCommissionRatesSeeded();
        return buildCommissionReport({
          rows: rows.map((row) => ({ employee: row.employee, amount: row.amount, branch: row.branch })),
          rates,
          month: parsedMY?.month ?? getCurrentArabicMonth(),
          monthYear: targetMY,
          employeeName: input.employeeName,
          branch: input.branch,
          employeeAliases,
        });
      }),

    /** إضافة موظف جديد */
    addEmployee: ownerProcedure
      .input(z.object({ employeeName: z.string().min(1), rate: z.number().min(0).max(100) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(commissionRates).values({ employeeName: input.employeeName, rate: String(input.rate) });
        return { success: true };
      }),

    /** تعديل نسبة أو اسم موظف */
    updateEmployee: ownerProcedure
      .input(z.object({ id: z.number(), employeeName: z.string().min(1), rate: z.number().min(0).max(100), isActive: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(commissionRates)
          .set({ employeeName: input.employeeName, rate: String(input.rate), isActive: input.isActive })
          .where(eq(commissionRates.id, input.id));
        return { success: true };
      }),

    /** حذف موظف */
    deleteEmployee: ownerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(commissionRates).where(eq(commissionRates.id, input.id));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
