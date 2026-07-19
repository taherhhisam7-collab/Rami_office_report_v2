import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import { TrendingUp, Banknote, FileText, Building2, Loader2, AlertCircle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

// ===== ألوان الرسوم البيانية =====
const CHART_COLORS = [
  "#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#84cc16",
];

// ألوان مميزة للموظفين (متباينة بشكل واضح)
const EMPLOYEE_COLORS = [
  { bg: "#6366f1", text: "#ffffff" }, // بنفسجي
  { bg: "#0ea5e9", text: "#ffffff" }, // أزرق
  { bg: "#22c55e", text: "#ffffff" }, // أخضر
  { bg: "#f59e0b", text: "#000000" }, // برتقالي
  { bg: "#ef4444", text: "#ffffff" }, // أحمر
  { bg: "#8b5cf6", text: "#ffffff" }, // بنفسجي فاتح
  { bg: "#14b8a6", text: "#ffffff" }, // تيل
  { bg: "#f97316", text: "#ffffff" }, // برتقالي غامق
  { bg: "#ec4899", text: "#ffffff" }, // وردي
  { bg: "#84cc16", text: "#000000" }, // أصفر-أخضر
  { bg: "#06b6d4", text: "#ffffff" }, // سماوي
  { bg: "#d946ef", text: "#ffffff" }, // بنفسجي وردي
];

// أسماء الأيام بالعربية
const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function formatDateWithDay(dateStr: string): string {
  // dateStr مثل "24/06/2026" أو "2026-06-24"
  try {
    let d: Date;
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        // DD/MM/YYYY
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else return dateStr;
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return dateStr;
    const dayName = ARABIC_DAYS[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dayName} ${dd}-${mm}-${yyyy}`;
  } catch {
    return dateStr;
  }
}

// مكوّن Label مخصص داخل أعمدة الموظفين
const EmployeeBarLabel = (props: any) => {
  const { x, y, width, height, value, name, index } = props;
  const color = EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length];
  if (!name || height < 18) return null;
  const truncated = name.length > 12 ? name.slice(0, 12) + "…" : name;
  const textX = x + width / 2;
  const textY = y + height / 2;
  return (
    <text
      x={textX}
      y={textY}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={color.text}
      fontSize={10}
      fontFamily="Tajawal"
      fontWeight="600"
    >
      {truncated}
    </text>
  );
};

// ===== خريطة الشهور العربية (للواجهة) =====
const ARABIC_MONTHS_MAP: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل", 5: "مايو", 6: "يونيو",
  7: "يوليو", 8: "أغسطس", 9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

// ===== حساب الفترات الزمنية =====
type Period = "all" | "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "quarter" | "year" | "custom";
const DASHBOARD_PERIODS: Array<{ value: Period; label: string }> = [
  { value: "all", label: "كل الفترات" }, { value: "today", label: "اليوم" }, { value: "yesterday", label: "أمس" },
  { value: "week", label: "هذا الأسبوع" }, { value: "last_week", label: "الأسبوع الماضي" }, { value: "month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" }, { value: "quarter", label: "هذا الربع" }, { value: "year", label: "هذه السنة" }, { value: "custom", label: "نطاق مخصص" },
];

function getPeriodRange(period: Period, customFrom?: string, customTo?: string): { startTs?: number; endTs?: number; month?: string; label: string } {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startTs: start.getTime(), endTs: endOfDay.getTime(), label: "اليوم" };
    }
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      return { startTs: start.getTime(), endTs: endOfDay.getTime(), label: "هذا الأسبوع" };
    }
    case "yesterday": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
      return { startTs: start.getTime(), endTs: end.getTime(), label: "أمس" };
    }
    case "last_week": {
      const day = now.getDay() || 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 6);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { startTs: start.getTime(), endTs: end.getTime(), label: "الأسبوع الماضي" };
    }
    case "month": {
      // إرسال اسم الشهر العربي مباشرة — يُحمَّل تبويب الشهر كاملاً بدون فلترة تاريخ
      const monthName = ARABIC_MONTHS_MAP[now.getMonth() + 1];
      return { month: monthName, label: `هذا الشهر (${monthName})` };
    }
    case "last_month": {
      // الشهر السابق بالاسم العربي مباشرة
      const prevMonthIdx = now.getMonth() === 0 ? 12 : now.getMonth();
      const monthName = ARABIC_MONTHS_MAP[prevMonthIdx];
      return { month: monthName, label: `الشهر السابق (${monthName})` };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { startTs: start.getTime(), endTs: endOfDay.getTime(), label: "هذا الربع" };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startTs: start.getTime(), endTs: endOfDay.getTime(), label: "هذه السنة" };
    }
    case "custom": {
      const startTs = customFrom ? new Date(customFrom).getTime() : undefined;
      const endTs = customTo ? new Date(customTo + "T23:59:59").getTime() : undefined;
      return { startTs, endTs, label: "فترة مخصصة" };
    }
    default:
      return { label: "كل الوقت" };
  }
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
  return n.toLocaleString("ar-SA");
}

function formatAmountFull(n: number): string {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {formatAmountFull(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();

  const [period, setPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthSearch, setMonthSearch] = useState("");
  const [branch, setBranch] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { startTs, endTs, month: periodMonth, label: periodLabel } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const filtersInput = useMemo(() => ({
    startTs,
    endTs,
    month: periodMonth,
    monthYear: period === "month" ? (selectedMonth || undefined) : undefined,
    branch: branch !== "all" ? branch : undefined,
  }), [startTs, endTs, periodMonth, selectedMonth, period, branch]);

  const utils = trpc.useUtils();

  const { data: stats, isLoading, error, dataUpdatedAt } = trpc.sheets.dashboardStats.useQuery(
    filtersInput,
    { refetchInterval: 60_000 } // تحديث تلقائي كل 60 ثانية
  );
  const { data: filterOpts } = trpc.sheets.filterOptions.useQuery({});
  const { data: monthInfo } = trpc.sheets.currentMonth.useQuery();
  const availableMonths = filterOpts?.availableMonthYears ?? [];
  const visibleMonths = availableMonths.filter((m: string) => m.toLowerCase().includes(monthSearch.toLowerCase()));

  const handleRefresh = () => {
    utils.sheets.dashboardStats.invalidate();
    utils.sheets.filterOptions.invalidate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">جاري تحميل البيانات من Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center">
          <AlertCircle className="h-8 w-8" />
          <p className="font-semibold">تعذّر تحميل البيانات</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="space-y-6">
      {/* ===== الرأس ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {"عرض بيانات جميع الفروع — الشهر الحالي: "}
            <span className="font-semibold text-primary">{monthInfo?.month ?? stats?.currentMonth ?? "..."}</span>
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground mr-2">
                آخر تحديث: {new Date(dataUpdatedAt).toLocaleTimeString("ar-SA")}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر تحديث */}
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 h-9 bg-card">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
          {/* فلتر الفترة الزمنية */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input value={monthSearch} onChange={(e) => setMonthSearch(e.target.value)} placeholder="بحث داخل الشهور" className="h-9 w-36 rounded-md border border-input bg-card px-2 text-sm" />
            <Select value={selectedMonth || "none"} onValueChange={(v) => { if (v !== "none") { setSelectedMonth(v); setPeriod("month"); } }}>
              <SelectTrigger className="w-36 bg-card"><SelectValue placeholder="الشهر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">اختر الشهر</SelectItem>
                {visibleMonths.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_PERIODS.map((option) => (
              <button key={option.value} type="button" onClick={() => { setCustomFrom(""); setCustomTo(""); if (option.value === "month") setSelectedMonth(monthInfo?.monthYear ?? ""); setPeriod(option.value); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${period === option.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="last_month">الشهر السابق</SelectItem>
              <SelectItem value="quarter">هذا الربع</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
              <SelectItem value="all">كل الوقت</SelectItem>
              <SelectItem value="custom">فترة مخصصة</SelectItem>
            </SelectContent>
          </Select>
          {/* حقول التاريخ المخصصة */}
          {period === "custom" && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 px-2 text-sm rounded-md border border-input bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="من"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 px-2 text-sm rounded-md border border-input bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="إلى"
              />
            </>
          )}
          {/* فلتر الفرع */}
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-36 bg-card">
              <SelectValue placeholder="كل الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفروع</SelectItem>
              {filterOpts?.branches.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== بطاقات الملخص ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبالغ"
          value={formatAmountFull(s.totalAmount)}
          subtitle={`${s.totalCount} سند`}
          icon={<Banknote className="h-5 w-5" />}
          gradient="from-indigo-600 to-indigo-700"
        />
        <StatCard
          title="عدد الفروع"
          value={s.byBranch.length.toString()}
          subtitle="فرع نشط"
          icon={<Building2 className="h-5 w-5" />}
          gradient="from-teal-600 to-teal-700"
        />
        <StatCard
          title="أعلى فرع"
          value={s.byBranch[0]?.key ?? "—"}
          subtitle={s.byBranch[0] ? formatAmountFull(s.byBranch[0].total) : ""}
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="from-emerald-600 to-emerald-700"
        />
        <StatCard
          title="عدد السجلات"
          value={s.totalCount.toLocaleString("ar-SA")}
          subtitle={`${s.byEmployee.length} موظف`}
          icon={<FileText className="h-5 w-5" />}
          gradient="from-amber-500 to-amber-600"
        />
      </div>

      {/* ===== الرسوم البيانية - الصف الأول ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* إجمالي المبالغ لكل فرع */}
        <ChartCard title="إجمالي المبالغ لكل فرع">
          {s.byBranch.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={s.byBranch} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="key" tick={{ fontSize: 12, fontFamily: "Tajawal", fill: "#111827" }} />
                <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "#111827" }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {s.byBranch.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* توزيع طرق الدفع */}
        <ChartCard title="توزيع طرق الدفع" contentClassName="rounded-b-xl bg-white">
          {s.byPayment.length === 0 ? <EmptyChart /> : (
            <div className="space-y-2">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={s.byPayment}
                  dataKey="total"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={false}
                  labelLine={false}
                >
                  {s.byPayment.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatAmountFull(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 px-2 pb-1">
              {s.byPayment.map((item, i) => (
                <div key={item.key} className="flex items-center justify-between rounded-md bg-white border border-slate-200 px-2 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-800 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {item.key}
                  </span>
                  <span className="text-slate-700">{formatAmount(item.total)}</span>
                </div>
              ))}
            </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ===== الرسوم البيانية - الصف الثاني ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* الإيرادات حسب الخدمة */}
        <ChartCard title="الإيرادات حسب الخدمة">
          {s.byService.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={s.byService.slice(0, 10)}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={formatAmount} tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "#111827" }} />
                <YAxis
                  type="category"
                  dataKey="key"
                  width={130}
                  tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "#111827" }}
                  tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + "…" : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {s.byService.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* أداء الموظفين */}
        <ChartCard title="أداء الموظفين" contentClassName="rounded-b-xl bg-white">
          {s.byEmployee.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              لا توجد بيانات موظفين في هذه الفترة
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(320, s.byEmployee.slice(0, 12).length * 52 + 30)}>
              <BarChart
                data={s.byEmployee.slice(0, 12).map((e, i) => ({ ...e, _colorIdx: i }))}
                layout="vertical"
                margin={{ top: 5, right: 90, left: 110, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={formatAmountFull} tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "#111827" }} />
                <YAxis
                  type="category"
                  dataKey="key"
                  width={130}
                  tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "#111827", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => v.length > 16 ? `${v.slice(0, 16)}…` : v}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                        <p className="font-semibold text-foreground mb-1">{d.payload?.key}</p>
                        <p style={{ color: d.color }} className="font-medium">{formatAmountFull(d.value as number)}</p>
                        <p className="text-xs text-muted-foreground">{d.payload?.count} سند</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" radius={[0, 6, 6, 0]} isAnimationActive={false}
                  label={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const emp = s.byEmployee.slice(0, 12)[index];
                    if (!emp || height < 16) return <g />;
                    const amtStr = formatAmountFull(value);
                    return (
                      <g>
                        <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle"
                          fill="#111827" fontSize={11} fontFamily="Tajawal" fontWeight="600">
                          {amtStr}
                        </text>
                      </g>
                    );
                  }}
                >
                  {s.byEmployee.slice(0, 12).map((_, i) => (
                    <Cell key={i} fill={EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length].bg} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ===== السلسلة الزمنية ===== */}
      {s.timeSeries.length > 1 && (
        <ChartCard title="تطور الإيرادات عبر الزمن">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={s.timeSeries} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fontFamily: "Tajawal" }}
                tickFormatter={formatDateWithDay}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={55}
              />
              <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11, fontFamily: "Tajawal" }} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ===== جدول ملخص الفروع ===== */}
      {s.byBranch.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">ملخص الفروع التفصيلي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">الفرع</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">إجمالي المبالغ</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">عدد السندات</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">متوسط السند</th>
                    <th className="text-right py-2 px-3 font-semibold text-muted-foreground">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byBranch.map((b, i) => {
                    const pct = s.totalAmount > 0 ? ((b.total / s.totalAmount) * 100).toFixed(1) : "0";
                    const avg = b.count > 0 ? b.total / b.count : 0;
                    return (
                      <tr key={b.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="font-medium">{b.key}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">{formatAmountFull(b.total)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{b.count}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatAmountFull(avg)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 max-w-20">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-left">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== مكونات مساعدة =====

function StatCard({
  title, value, subtitle, icon, gradient,
}: {
  title: string; value: string; subtitle: string;
  icon: React.ReactNode; gradient: string;
}) {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} text-white shrink-0 mr-3`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, contentClassName = "" }: { title: string; children: React.ReactNode; contentClassName?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`pt-0 ${contentClassName}`}>{children}</CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      لا توجد بيانات في هذه الفترة
    </div>
  );
}
