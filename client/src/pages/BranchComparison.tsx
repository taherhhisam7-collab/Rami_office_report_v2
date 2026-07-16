import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const BRANCH_COLORS: Record<string, string> = {
  "الدمام":  "#6366f1",
  "الرياض":  "#f59e0b",
  "جدة":     "#10b981",
  "المدينة": "#ec4899",
};

function formatAmount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}ك`;
  return n.toLocaleString("ar-SA");
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm" dir="rtl">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: p.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-foreground">{Number(p.value).toLocaleString("ar-SA")} ر.س</span>
        </div>
      ))}
    </div>
  );
};

export default function BranchComparison() {
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const [refetchKey, setRefetchKey] = useState(0);

  const { data, isLoading, refetch } = trpc.sheets.branchComparison.useQuery(
    { month: selectedMonth },
    { refetchInterval: 60_000, queryHash: String(refetchKey) }
  );

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.comparison.map((b) => ({
      branch: b.branch,
      [data.currentMonth]: b.currentTotal,
      [data.prevMonth || "الشهر السابق"]: b.prevTotal,
    }));
  }, [data]);

  const handleRefresh = () => {
    setRefetchKey((k) => k + 1);
    refetch();
  };

  return (
    <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">مقارنة الفروع الشهرية</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data?.isPartialComparison
                ? <>مقارنة <span className="font-semibold text-foreground">{data.comparisonLabel}</span> مقابل <span className="font-semibold text-amber-600 dark:text-amber-400">{data.prevComparisonLabel}</span></>
                : data?.prevMonth
                ? <>مقارنة شهر <span className="font-semibold text-foreground">{data.currentMonth}</span> كاملاً مقابل شهر <span className="font-semibold text-amber-600 dark:text-amber-400">{data.prevMonth}</span> كاملاً</>
                : "مقارنة أداء الفروع مع نسب النمو"
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedMonth ?? "current"}
              onValueChange={(v) => setSelectedMonth(v === "current" ? undefined : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="الشهر الحالي" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">الشهر الحالي</SelectItem>
                {ARABIC_MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* بطاقات الفروع */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.comparison.map((b) => {
                const isUp = b.growth > 0;
                const isDown = b.growth < 0;
                const color = BRANCH_COLORS[b.branch] ?? "#6366f1";
                return (
                  <Card key={b.branch} className="relative overflow-hidden border-0 shadow-md">
                    {/* شريط اللون العلوي */}
                    <div className="absolute top-0 right-0 left-0 h-1 rounded-t-2xl" style={{ background: color }} />
                    <CardHeader className="pb-2 pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg" style={{ background: `${color}18` }}>
                            <Building2 className="h-4 w-4" style={{ color }} />
                          </div>
                          <CardTitle className="text-base font-bold">{b.branch}</CardTitle>
                        </div>
                        {/* نسبة نمو الإيرادات مع الشهر السابق */}
                        <div
                          className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                            isUp
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : isDown
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {isUp ? "+" : ""}{b.growth}%
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* الشهر الحالي */}
                      <div>
                        <p className="text-xs text-muted-foreground">{data.comparisonLabel || data.currentMonth}</p>
                        <p className="text-xl font-bold text-foreground">
                          {b.currentTotal.toLocaleString("ar-SA")}
                          <span className="text-sm font-normal text-muted-foreground mr-1">ر.س</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{b.currentCount} سند</p>
                      </div>
                      {/* الشهر السابق */}
                      {data.prevMonth && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground">{data.prevComparisonLabel || data.prevMonth}</p>
                          <p className="text-base font-semibold text-muted-foreground">
                            {b.prevTotal.toLocaleString("ar-SA")}
                            <span className="text-xs font-normal mr-1">ر.س</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{b.prevCount} سند</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* الإجماليات */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">{data.comparisonLabel || data.currentMonth} — الإجمالي</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {data.totalCurrent.toLocaleString("ar-SA")} <span className="text-sm font-normal text-muted-foreground">ر.س</span>
                  </p>
                </CardContent>
              </Card>
              {data.prevMonth && (
                <Card className="border-0 shadow-md bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">{data.prevComparisonLabel || data.prevMonth} — الإجمالي</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {data.totalPrev.toLocaleString("ar-SA")} <span className="text-sm font-normal text-muted-foreground">ر.س</span>
                    </p>
                  </CardContent>
                </Card>
              )}
              {data.prevMonth && (
                <Card className="border-0 shadow-md">
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">نسبة نمو الإيرادات مع الشهر السابق</p>
                    {(() => {
                      const g = data.totalPrev === 0
                        ? (data.totalCurrent > 0 ? 100 : 0)
                        : Math.round(((data.totalCurrent - data.totalPrev) / data.totalPrev) * 100);
                      const isUp = g > 0;
                      return (
                        <div className={`flex items-center gap-2 mt-1 ${isUp ? "text-emerald-600" : g < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                          {isUp ? <TrendingUp className="h-5 w-5" /> : g < 0 ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                          <span className="text-2xl font-bold">{isUp ? "+" : ""}{g}%</span>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* الرسم البياني المقارن */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold">
                  مقارنة المبالغ: {data.comparisonLabel || data.currentMonth}
                  {data.prevMonth ? ` مقابل ${data.prevComparisonLabel || data.prevMonth}` : ""}
                </CardTitle>
                {data.isPartialComparison && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <span>⚠</span> المقارنة بنفس عدد الأيام من {data.prevMonth} لضمان الدقة
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="branch"
                      tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatAmount}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(v) => <span style={{ fontSize: 13, color: "var(--foreground)" }}>{v}</span>}
                    />
                    <Bar dataKey={data.currentMonth} radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {data.comparison.map((b) => (
                        <Cell key={b.branch} fill={BRANCH_COLORS[b.branch] ?? "#6366f1"} />
                      ))}
                    </Bar>
                    {data.prevMonth && (
                      <Bar dataKey={data.prevMonth} radius={[6, 6, 0, 0]} maxBarSize={60} fill="#cbd5e1" opacity={0.7} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* جدول مفصل */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-bold">تفاصيل المقارنة</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-right py-3 px-4 font-semibold">الفرع</th>
                      <th className="text-right py-3 px-4 font-semibold">{data.comparisonLabel || data.currentMonth} (ر.س)</th>
                      <th className="text-right py-3 px-4 font-semibold">عدد السندات</th>
                      {data.prevMonth && (
                        <>
                          <th className="text-right py-3 px-4 font-semibold">{data.prevComparisonLabel || data.prevMonth} (ر.س)</th>
                          <th className="text-right py-3 px-4 font-semibold">عدد السندات</th>
                          <th className="text-right py-3 px-4 font-semibold">نسبة نمو الإيرادات مع الشهر السابق</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparison.map((b, i) => {
                      const color = BRANCH_COLORS[b.branch] ?? "#6366f1";
                      const isUp = b.growth > 0;
                      const isDown = b.growth < 0;
                      return (
                        <tr key={b.branch} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                              <span className="font-medium">{b.branch}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold">{b.currentTotal.toLocaleString("ar-SA")}</td>
                          <td className="py-3 px-4 text-muted-foreground">{b.currentCount}</td>
                          {data.prevMonth && (
                            <>
                              <td className="py-3 px-4 text-muted-foreground">{b.prevTotal.toLocaleString("ar-SA")}</td>
                              <td className="py-3 px-4 text-muted-foreground">{b.prevCount}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                                  isUp
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : isDown
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {isUp ? "+" : ""}{b.growth}%
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-bold text-foreground">
                      <td className="py-3 px-4">الإجمالي</td>
                      <td className="py-3 px-4">{data.totalCurrent.toLocaleString("ar-SA")}</td>
                      <td className="py-3 px-4">{data.comparison.reduce((s, b) => s + b.currentCount, 0)}</td>
                      {data.prevMonth && (
                        <>
                          <td className="py-3 px-4">{data.totalPrev.toLocaleString("ar-SA")}</td>
                          <td className="py-3 px-4">{data.comparison.reduce((s, b) => s + b.prevCount, 0)}</td>
                          <td className="py-3 px-4">
                            {(() => {
                              const g = data.totalPrev === 0
                                ? (data.totalCurrent > 0 ? 100 : 0)
                                : Math.round(((data.totalCurrent - data.totalPrev) / data.totalPrev) * 100);
                              const isUp = g > 0;
                              return (
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                                  isUp ? "bg-emerald-100 text-emerald-700" : g < 0 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
                                }`}>
                                  {isUp ? <TrendingUp className="h-3 w-3" /> : g < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                  {isUp ? "+" : ""}{g}%
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد بيانات للعرض</p>
          </div>
        )}
    </div>
  );
}
