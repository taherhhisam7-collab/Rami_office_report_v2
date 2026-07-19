import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, ReferenceLine, LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart2, Loader2, AlertCircle } from "lucide-react";

// ===== ألوان الفروع =====
const BRANCH_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  "جدة":     { bg: "#6366f1", text: "#ffffff", light: "#eef2ff" },
  "الدمام":  { bg: "#0ea5e9", text: "#ffffff", light: "#e0f2fe" },
  "الرياض":  { bg: "#22c55e", text: "#ffffff", light: "#dcfce7" },
  "المدينة": { bg: "#f59e0b", text: "#ffffff", light: "#fef3c7" },
};
const DEFAULT_COLOR = { bg: "#8b5cf6", text: "#ffffff", light: "#f3e8ff" };
const getBranchColor = (branch: string) => BRANCH_COLORS[branch] ?? DEFAULT_COLOR;

// ===== تنسيق المبلغ =====
function formatAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "ك";
  return n.toLocaleString("ar-SA");
}
function formatAmountFull(n: number): string {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

// ===== KPI Card =====
function KpiCard({
  title, value, subtitle, trend, color,
}: {
  title: string; value: string; subtitle?: string;
  trend?: "up" | "down" | "neutral"; color?: string;
}) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#94a3b8";
  return (
    <Card className="border-0 shadow-sm" style={{ borderTop: `3px solid ${color ?? "#6366f1"}` }}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{title}</p>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold" style={{ color: color ?? "#6366f1" }}>{value}</span>
          {trend && (
            <Icon size={18} style={{ color: trendColor }} className="mb-1" />
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ===== Tooltip مخصص =====
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm min-w-[140px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color ?? p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatAmountFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ===== Waterfall Tooltip =====
function WaterfallTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const net = payload.find((p: any) => p.name === "net");
  if (!net) return null;
  const isPositive = net.value >= 0;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm min-w-[160px]">
      <p className="font-bold text-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: isPositive ? "#22c55e" : "#ef4444" }} />
        <span className="text-muted-foreground">صافي التغير:</span>
        <span className="font-medium" style={{ color: isPositive ? "#22c55e" : "#ef4444" }}>
          {isPositive ? "+" : ""}{formatAmountFull(net.value)}
        </span>
      </div>
    </div>
  );
}

export default function GrowthReport() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [branch, setBranch] = useState<string>("all");

  // جلب بيانات تقرير النمو
  const { data, isLoading, error } = trpc.sheets.growthReport.useQuery(
    { selectedMonth: selectedMonth || undefined, branch: branch === "all" ? undefined : branch },
    { staleTime: 30_000 }
  );

  // جلب الأشهر المتاحة من filterOptions
  const { data: filterOpts } = trpc.sheets.filterOptions.useQuery(undefined, { staleTime: 60_000 });

  // تحديد الشهر الافتراضي
  const currentMonth = data?.currentMonth ?? filterOpts?.currentMonth ?? "";
  const availableMonths = data?.availableMonthYears ?? filterOpts?.availableMonthYears ?? [];

  // بيانات Waterfall Chart
  const waterfallData = useMemo(() => {
    if (!data?.branchDetails) return [];
    return data.branchDetails.map((b) => ({
      branch: b.branch,
      base: b.netChange >= 0 ? b.prevTotal : b.prevTotal + b.netChange,
      net: b.netChange,
      isPositive: b.netChange >= 0,
    }));
  }, [data]);

  // بيانات Donut Chart (حصة كل فرع من الإيرادات الحالية)
  const donutData = useMemo(() => {
    if (!data?.branchDetails) return [];
    return data.branchDetails
      .filter((b) => b.currTotal > 0)
      .map((b) => ({
        name: b.branch,
        value: b.currTotal,
        color: getBranchColor(b.branch).bg,
      }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="text-muted-foreground">جاري تحميل بيانات النمو...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-destructive">
        <AlertCircle size={24} />
        <span>خطأ في تحميل البيانات: {error.message}</span>
      </div>
    );
  }

  const growthTrend = data?.totalGrowthPct !== undefined
    ? data.totalGrowthPct > 0 ? "up" : data.totalGrowthPct < 0 ? "down" : "neutral"
    : "neutral";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="text-primary" size={26} />
            تقرير النمو
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.isPartialComparison
              ? <>مقارنة <span className="font-semibold text-foreground">{data.comparisonLabel}</span> مقابل <span className="font-semibold text-amber-600 dark:text-amber-400">{data.prevComparisonLabel}</span></>
              : data?.prevMonth
              ? <>مقارنة شهر <span className="font-semibold text-foreground">{data.currentMonth}</span> كاملاً مقابل شهر <span className="font-semibold text-amber-600 dark:text-amber-400">{data.prevMonth}</span> كاملاً</>
              : "مقارنة إيرادات الشهر الحالي"
            }
            {data?.prevMonthExists === false && data?.prevMonth && (
              <span className="text-amber-500 mr-2">(لا توجد بيانات للشهر السابق - تُعتبر صفر)</span>
            )}
          </p>
        </div>

        {/* ===== فلاتر ===== */}
        <div className="flex flex-wrap gap-3">
          <Select
            value={selectedMonth || currentMonth}
            onValueChange={(v) => setSelectedMonth(v)}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="الشهر" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m: string) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفروع</SelectItem>
              {["جدة", "الدمام", "الرياض", "المدينة"].map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي نسبة نمو الإيرادات"
          value={`${data?.totalGrowthPct !== undefined ? (data.totalGrowthPct > 0 ? "+" : "") + data.totalGrowthPct + "%" : "—"}`}
          subtitle={data?.isPartialComparison
            ? `${data.comparisonLabel} مقابل ${data.prevComparisonLabel}`
            : `${data?.currentMonth ?? ""} مقارنةً بـ ${data?.prevMonth ?? "الشهر السابق"}`
          }
          trend={growthTrend}
          color={growthTrend === "up" ? "#22c55e" : growthTrend === "down" ? "#ef4444" : "#94a3b8"}
        />
        <KpiCard
          title="صافي الزيادة المالية المحققة"
          value={data?.totalNetChange !== undefined ? (data.totalNetChange >= 0 ? "+" : "") + formatAmountFull(data.totalNetChange) : "—"}
          subtitle="الفرق بين الشهرين"
          trend={data?.totalNetChange !== undefined ? (data.totalNetChange > 0 ? "up" : data.totalNetChange < 0 ? "down" : "neutral") : "neutral"}
          color="#6366f1"
        />
        <KpiCard
          title={`إيرادات ${data?.currentMonth ?? "الشهر الحالي"}`}
          value={data?.totalCurrent !== undefined ? formatAmountFull(data.totalCurrent) : "—"}
          subtitle="إجمالي الفترة المختارة"
          color="#0ea5e9"
        />
        <KpiCard
          title={data?.isPartialComparison
            ? `إيرادات ${data.prevComparisonLabel}`
            : `إيرادات ${data?.prevMonth ?? "الشهر السابق"}`
          }
          value={data?.totalPrev !== undefined ? formatAmountFull(data.totalPrev) : "—"}
          subtitle={data?.prevMonthExists === false ? "لا توجد بيانات (صفر)" : data?.isPartialComparison ? "نفس الفترة من الشهر السابق" : "إجمالي الفترة السابقة"}
          color="#f59e0b"
        />
      </div>

      {/* ===== الرسوم البيانية - صف أول ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* منحنى تطور الإيرادات */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">منحنى تطور الإيرادات عبر الزمن</CardTitle>
            <p className="text-xs text-muted-foreground">الإيرادات الإجمالية لكل شهر متاح</p>
          </CardHeader>
          <CardContent>
            {data?.trendData && data.trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.trendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fontFamily: "Tajawal", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    tickFormatter={formatAmount}
                    tick={{ fontSize: 10, fontFamily: "Tajawal", fill: "hsl(var(--muted-foreground))" }}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="الإيرادات"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات كافية</div>
            )}
          </CardContent>
        </Card>

        {/* مخطط مساهمة النمو - Donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">مساهمة كل فرع في الإيرادات</CardTitle>
            <p className="text-xs text-muted-foreground">حصة كل فرع من إجمالي إيرادات {data?.currentMonth ?? "الشهر المختار"}</p>
          </CardHeader>
          <CardContent className="rounded-b-xl bg-white">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatAmountFull(v)} />
                  <Legend
                    formatter={(value) => <span style={{ fontFamily: "Tajawal", fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Waterfall Chart ===== */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">مخطط الشلال التحليلي - صافي التغير المالي</CardTitle>
          <p className="text-xs text-muted-foreground">
            يوضح أي الفروع قادت النمو الإيجابي وأيها تراجعت ماليًا بين {data?.isPartialComparison ? data.prevComparisonLabel : (data?.prevMonth ?? "الشهر السابق")} و{data?.isPartialComparison ? data.comparisonLabel : (data?.currentMonth ?? "الشهر الحالي")}
          </p>
        </CardHeader>
        <CardContent>
          {waterfallData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="branch"
                  tick={{ fontSize: 12, fontFamily: "Tajawal", fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickFormatter={formatAmount}
                  tick={{ fontSize: 10, fontFamily: "Tajawal", fill: "hsl(var(--muted-foreground))" }}
                  width={65}
                />
                <Tooltip content={<WaterfallTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                {/* القاعدة الشفافة للـ waterfall */}
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="net" stackId="a" name="net" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isPositive ? "#22c55e" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                  <LabelList
                    dataKey="net"
                    position="top"
                    formatter={(v: number) => (v >= 0 ? "+" : "") + formatAmount(v)}
                    style={{ fontSize: 11, fontFamily: "Tajawal", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </CardContent>
      </Card>

      {/* ===== جدول تفاصيل النمو ===== */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">جدول تفاصيل النمو</CardTitle>
          <p className="text-xs text-muted-foreground">
            مقارنة إيرادات كل فرع بين {data?.isPartialComparison ? data.prevComparisonLabel : (data?.prevMonth ?? "الشهر السابق")} و{data?.isPartialComparison ? data.comparisonLabel : (data?.currentMonth ?? "الشهر الحالي")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">اسم الفرع</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                    إيرادات {data?.isPartialComparison ? data.prevComparisonLabel : (data?.prevMonth ?? "الشهر السابق")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                    إيرادات {data?.currentMonth ?? "الشهر الحالي"}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">صافي التغير</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">نسبة نمو الإيرادات مع الشهر السابق</th>
                </tr>
              </thead>
              <tbody>
                {data?.branchDetails?.map((b, i) => {
                  const color = getBranchColor(b.branch);
                  const isUp = b.growthPct > 0;
                  const isDown = b.growthPct < 0;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ background: color.bg }}
                          />
                          <span className="font-medium">{b.branch}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{formatAmountFull(b.prevTotal)}</td>
                      <td className="py-3 px-4 font-medium">{formatAmountFull(b.currTotal)}</td>
                      <td className="py-3 px-4">
                        <span style={{ color: isUp ? "#22c55e" : isDown ? "#ef4444" : "#94a3b8" }} className="font-medium">
                          {b.netChange >= 0 ? "+" : ""}{formatAmountFull(b.netChange)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{
                              background: isUp ? "#dcfce7" : isDown ? "#fee2e2" : "#f1f5f9",
                              color: isUp ? "#16a34a" : isDown ? "#dc2626" : "#64748b",
                            }}
                          >
                            {isUp ? "▲" : isDown ? "▼" : "—"}
                            {" "}{Math.abs(b.growthPct)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* إجمالي */}
              {data && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td className="py-3 px-4 font-bold">الإجمالي</td>
                    <td className="py-3 px-4 font-bold text-muted-foreground">{formatAmountFull(data.totalPrev)}</td>
                    <td className="py-3 px-4 font-bold">{formatAmountFull(data.totalCurrent)}</td>
                    <td className="py-3 px-4 font-bold">
                      <span style={{ color: data.totalNetChange >= 0 ? "#22c55e" : "#ef4444" }}>
                        {data.totalNetChange >= 0 ? "+" : ""}{formatAmountFull(data.totalNetChange)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: data.totalGrowthPct > 0 ? "#dcfce7" : data.totalGrowthPct < 0 ? "#fee2e2" : "#f1f5f9",
                          color: data.totalGrowthPct > 0 ? "#16a34a" : data.totalGrowthPct < 0 ? "#dc2626" : "#64748b",
                        }}
                      >
                        {data.totalGrowthPct > 0 ? "▲" : data.totalGrowthPct < 0 ? "▼" : "—"}
                        {" "}{Math.abs(data.totalGrowthPct)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
