import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, Download, Filter, Calendar, ChevronRight, ChevronLeft } from "lucide-react";

// ===== أنواع الفترات الزمنية =====
type Period = "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "quarter" | "year" | "custom";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "yesterday", label: "أمس" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "last_week", label: "الأسبوع الماضي" },
  { value: "month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "quarter", label: "هذا الربع" },
  { value: "year", label: "هذه السنة" },
  { value: "custom", label: "نطاق مخصص" },
];

function getPeriodRange(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today":
      return { startTs: today.getTime(), endTs: endOfDay(today).getTime() };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { startTs: y.getTime(), endTs: endOfDay(y).getTime() };
    }
    case "week": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const start = new Date(today); start.setDate(start.getDate() - diff);
      return { startTs: start.getTime(), endTs: endOfDay(today).getTime() };
    }
    case "last_week": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const thisWeekStart = new Date(today); thisWeekStart.setDate(thisWeekStart.getDate() - diff);
      const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      return { startTs: lastWeekStart.getTime(), endTs: endOfDay(lastWeekEnd).getTime() };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startTs: start.getTime(), endTs: endOfDay(today).getTime() };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startTs: start.getTime(), endTs: endOfDay(end).getTime() };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { startTs: start.getTime(), endTs: endOfDay(today).getTime() };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startTs: start.getTime(), endTs: endOfDay(today).getTime() };
    }
    case "custom": {
      const startTs = customStart ? new Date(customStart).getTime() : undefined;
      const endTs = customEnd ? endOfDay(new Date(customEnd)).getTime() : undefined;
      return { startTs, endTs };
    }
    default:
      return {};
  }
}

function formatAmountFull(n: number): string {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ===== تصدير CSV =====
function exportToCSV(records: any[]) {
  const headers = ["رقم السند", "التاريخ", "الفرع", "اسم العميل", "الخدمة", "المبلغ", "طريقة الدفع", "الموظف", "ملاحظات"];
  const rows = records.map((r) => [
    r.receiptNo, formatDate(r.dateTs), r.branch, r.customerName,
    r.service, r.amount, r.paymentMethod, r.employee, r.notes,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `سندات_القبض_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [branch, setBranch] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [service, setService] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("current"); // الشهر العربي
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { startTs, endTs } = useMemo(
    () => getPeriodRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const queryInput = useMemo(() => ({
    startTs,
    endTs,
    branch: branch !== "all" ? branch : undefined,
    paymentMethod: paymentMethod !== "all" ? paymentMethod : undefined,
    employee: employee !== "all" ? employee : undefined,
    service: service !== "all" ? service : undefined,
    month: selectedMonth !== "current" ? selectedMonth : undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [startTs, endTs, branch, paymentMethod, employee, service, selectedMonth, search, page]);

  const { data, isLoading, error } = trpc.sheets.records.useQuery(queryInput);
  const { data: filterOpts } = trpc.sheets.filterOptions.useQuery({ monthYear: selectedMonth !== "current" ? selectedMonth : undefined });
  const { data: monthInfo } = trpc.sheets.currentMonth.useQuery();

  // إعادة الصفحة إلى 1 عند تغيير أي فلتر
  const resetPage = useCallback(() => setPage(1), []);

  const activeFiltersCount = [
    period !== "month",
    branch !== "all",
    paymentMethod !== "all",
    employee !== "all",
    service !== "all",
    !!search,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPeriod("month");
    setCustomStart("");
    setCustomEnd("");
    setBranch("all");
    setPaymentMethod("all");
    setEmployee("all");
    setService("all");
    setSelectedMonth("current");
    setSearch("");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* ===== الرأس ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التقارير المتقدمة</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            فلترة وتحليل سندات القبض من جميع الفروع
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => data && exportToCSV(data.records)}
          disabled={!data || data.records.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          تصدير CSV
        </Button>
      </div>

      {/* ===== لوحة الفلاتر ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              خيارات الفلترة
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="text-xs">{activeFiltersCount} فلتر نشط</Badge>
              )}
            </CardTitle>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <X className="h-3 w-3" />
                مسح الكل
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* الفترة الزمنية - الأولوية القصوى */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5" />
              الفترة الزمنية
            </label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setPeriod(opt.value); resetPage(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    period === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* حقول النطاق المخصص */}
            {period === "custom" && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">من تاريخ</label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => { setCustomStart(e.target.value); resetPage(); }}
                    className="bg-background"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">إلى تاريخ</label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => { setCustomEnd(e.target.value); resetPage(); }}
                    className="bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          {/* فلتر الشهر العربي */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5" />
              الشهر (تبويب Google Sheets)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedMonth("current"); resetPage(); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedMonth === "current"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                الشهر الحالي ({monthInfo?.month ?? "..."})
              </button>
              {filterOpts?.availableMonthYears?.filter((my: string) => my !== (monthInfo?.monthYear ?? "")).map((my: string) => (
                <button
                  key={my}
                  onClick={() => { setSelectedMonth(my); resetPage(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedMonth === my
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {my}
                </button>
              ))}
            </div>
          </div>

          {/* الفلاتر الإضافية */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">الفرع</label>
              <Select value={branch} onValueChange={(v) => { setBranch(v); resetPage(); }}>
                <SelectTrigger className="bg-background text-sm h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفروع</SelectItem>
                  {filterOpts?.branches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">طريقة الدفع</label>
              <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); resetPage(); }}>
                <SelectTrigger className="bg-background text-sm h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الطرق</SelectItem>
                  {filterOpts?.paymentMethods.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">الموظف</label>
              <Select value={employee} onValueChange={(v) => { setEmployee(v); resetPage(); }}>
                <SelectTrigger className="bg-background text-sm h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموظفين</SelectItem>
                  {filterOpts?.employees.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">الخدمة</label>
              <Select value={service} onValueChange={(v) => { setService(v); resetPage(); }}>
                <SelectTrigger className="bg-background text-sm h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الخدمات</SelectItem>
                  {filterOpts?.services.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* البحث النصي */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث بالاسم، رقم السند، الخدمة، الموظف..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="pr-9 bg-background"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); resetPage(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== بطاقات الملخص ===== */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryBadge label="إجمالي المبالغ" value={formatAmountFull(data.totalAmount)} color="text-primary" />
          <SummaryBadge label="عدد السندات" value={data.total.toLocaleString("ar-SA")} color="text-foreground" />
          <SummaryBadge
            label="متوسط السند"
            value={data.total > 0 ? formatAmountFull(data.totalAmount / data.total) : "—"}
            color="text-foreground"
          />
          <SummaryBadge
            label="الصفحة"
            value={`${data.page} / ${data.totalPages || 1}`}
            color="text-muted-foreground"
          />
        </div>
      )}

      {/* ===== جدول السجلات ===== */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-destructive text-sm">
              تعذّر تحميل البيانات: {error.message}
            </div>
          ) : !data || data.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">لا توجد سجلات تطابق الفلاتر المحددة</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">رقم السند</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">التاريخ</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">الفرع</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">اسم العميل</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">الخدمة</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">المبلغ</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">طريقة الدفع</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">الموظف</th>
                      <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-xs">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r, i) => (
                      <tr
                        key={`${r.receiptNo}-${i}`}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{r.receiptNo || "—"}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs">{r.date || "—"}</td>
                        <td className="py-2.5 px-3">
                          <BranchBadge branch={r.branch} />
                        </td>
                        <td className="py-2.5 px-3 font-medium max-w-[160px] truncate">{r.customerName}</td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[140px] truncate text-xs">{r.service}</td>
                        <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                          {r.amount.toLocaleString("ar-SA")} ر.س
                        </td>
                        <td className="py-2.5 px-3">
                          <PaymentBadge method={r.paymentMethod} />
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.employee || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[120px] truncate" title={r.notes}>
                          {r.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===== ترقيم الصفحات ===== */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    عرض {((page - 1) * PAGE_SIZE) + 1} – {Math.min(page * PAGE_SIZE, data.total)} من {data.total} سجل
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(data.totalPages - 4, page - 2)) + i;
                      return (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(p)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {p}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page === data.totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== مكونات مساعدة =====

function SummaryBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

const BRANCH_COLORS: Record<string, string> = {
  "الدمام": "bg-indigo-100 text-indigo-700",
  "الرياض": "bg-teal-100 text-teal-700",
  "جدة": "bg-emerald-100 text-emerald-700",
  "المدينة": "bg-amber-100 text-amber-700",
};

function BranchBadge({ branch }: { branch: string }) {
  const cls = BRANCH_COLORS[branch] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {branch}
    </span>
  );
}

const PAYMENT_COLORS: Record<string, string> = {
  "الأهلي": "bg-green-100 text-green-700",
  "الرياض": "bg-blue-100 text-blue-700",
  "الإنماء": "bg-purple-100 text-purple-700",
  "مدى": "bg-orange-100 text-orange-700",
  "كاش": "bg-yellow-100 text-yellow-700",
  "نقداً": "bg-yellow-100 text-yellow-700",
};

function PaymentBadge({ method }: { method: string }) {
  const cls = PAYMENT_COLORS[method] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {method}
    </span>
  );
}
