import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Landmark, Loader2, MapPin, MoonStar, RefreshCw, Search, Wallet, Waves } from "lucide-react";
import { toast } from "sonner";

type Period = "all" | "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "quarter" | "year" | "custom";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "all", label: "كل الفترات" },
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

function normalizeDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDate(value: string) {
  const dayFirst = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const yearFirst = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!dayFirst && !yearFirst) return undefined;
  const year = Number(yearFirst?.[1] ?? dayFirst?.[3]);
  const month = Number(yearFirst?.[2] ?? dayFirst?.[2]);
  const day = Number(yearFirst?.[3] ?? dayFirst?.[1]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateValue(timestamp?: number) {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function pickerValue(value: string) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatPickedDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function getRange(period: Period, customStart: string, customEnd: string) {
  const now = new Date();
  const today = dayStart(now);
  if (period === "custom") {
    return { startTs: parseDate(customStart)?.getTime(), endTs: parseDate(customEnd) ? dayEnd(parseDate(customEnd)!) : undefined };
  }
  if (period === "all") return {};
  if (period === "today") return { startTs: today, endTs: dayEnd(now) };
  if (period === "yesterday") {
    const date = new Date(today); date.setDate(date.getDate() - 1);
    return { startTs: dayStart(date), endTs: dayEnd(date) };
  }
  if (period === "week" || period === "last_week") {
    const start = new Date(today);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1 + (period === "last_week" ? -7 : 0));
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { startTs: dayStart(start), endTs: dayEnd(end) };
  }
  if (period === "month" || period === "last_month") {
    const offset = period === "last_month" ? -1 : 0;
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { startTs: dayStart(start), endTs: dayEnd(end) };
  }
  if (period === "quarter") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 3, 0);
    return { startTs: dayStart(start), endTs: dayEnd(end) };
  }
  return { startTs: new Date(now.getFullYear(), 0, 1).getTime(), endTs: dayEnd(now) };
}

function amount(value: number) {
  return `${value.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}

function branchIcon(branch: string) {
  if (branch.includes("\u062c\u062f\u0629")) return Landmark;
  if (branch.includes("\u0627\u0644\u062f\u0645\u0627\u0645")) return Waves;
  if (branch.includes("\u0627\u0644\u0631\u064a\u0627\u0636")) return Building2;
  if (branch.includes("\u0627\u0644\u0645\u062f\u064a\u0646\u0629")) return MoonStar;
  return MapPin;
}

function CashCard({ branch, balance }: { branch: string; balance: number }) {
  const BranchIcon = branchIcon(branch);

  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-blue-700">{branch}</p>
          <BranchIcon className="h-4 w-4 text-amber-500" />
        </div>
        <p className="mt-3 text-sm font-semibold text-orange-500">الرصيد الفعلي</p>
        <p className={`mt-1 text-xl font-bold ${balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : "text-muted-foreground"}`}>{amount(balance)}</p>
      </CardContent>
    </Card>
  );
}

export default function CashFlow() {
  const utils = trpc.useUtils();
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);
  const syncDataMutation = trpc.sheets.syncMonth.useMutation({
    onSuccess: async () => {
      await utils.sheets.invalidate();
      toast.success("تم تحديث البيانات");
    },
    onError: () => toast.error("فشل تحديث البيانات"),
  });
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [branch, setBranch] = useState("all");
  const [search, setSearch] = useState("");
  const { startTs, endTs } = useMemo(() => getRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const { data, isLoading, error } = trpc.sheets.cashFlow.useQuery({
    branch: branch === "all" ? undefined : branch,
    startTs,
    endTs,
    search: search || undefined,
  }, { refetchInterval: period === "month" ? 60_000 : false });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">حركة الكاش</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">متابعة الأرصدة وحركة الصرف والإيراد للفروع</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncDataMutation.mutate({})}
            disabled={syncDataMutation.isPending}
            className="flex items-center gap-2 border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500 hover:text-amber-950"
          >
            <RefreshCw className={`h-4 w-4 ${syncDataMutation.isPending ? "animate-spin" : ""}`} />
            تحديث البيانات
          </Button>
          <Badge variant="secondary" className="w-fit gap-1.5 px-3 py-1.5">
            <Wallet className="h-3.5 w-3.5" /> حركة مالية
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">الفلاتر</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(option => (
              <button key={option.value} onClick={() => { const range = getRange(option.value, "", ""); setCustomStart(formatDateValue(range.startTs)); setCustomEnd(formatDateValue(range.endTs)); setPeriod(option.value); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${period === option.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">من تاريخ</label>
              <div className="relative">
                <Input type="text" inputMode="numeric" dir="ltr" placeholder="YYYY/MM/DD" maxLength={10} value={customStart} onChange={event => { setCustomStart(normalizeDate(event.target.value)); setPeriod("custom"); }} className="bg-background pr-10 text-right" />
                <button type="button" aria-label="اختيار تاريخ البداية" onClick={() => { const picker = startDatePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.click(); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"><Calendar className="h-4 w-4" /></button>
                <input ref={startDatePickerRef} type="date" value={pickerValue(customStart)} onChange={event => { setCustomStart(formatPickedDate(event.target.value)); setPeriod("custom"); }} className="sr-only" tabIndex={-1} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">إلى تاريخ</label>
              <div className="relative">
                <Input type="text" inputMode="numeric" dir="ltr" placeholder="YYYY/MM/DD" maxLength={10} value={customEnd} onChange={event => { setCustomEnd(normalizeDate(event.target.value)); setPeriod("custom"); }} className="bg-background pr-10 text-right" />
                <button type="button" aria-label="اختيار تاريخ النهاية" onClick={() => { const picker = endDatePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.click(); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"><Calendar className="h-4 w-4" /></button>
                <input ref={endDatePickerRef} type="date" value={pickerValue(customEnd)} onChange={event => { setCustomEnd(formatPickedDate(event.target.value)); setPeriod("custom"); }} className="sr-only" tabIndex={-1} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">البحث</label>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في البيان أو الفرع" className="bg-background pr-9" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">الفرع</label>
              <select value={branch} onChange={event => setBranch(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">كل الفروع</option>
                {(data?.branches ?? []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(data?.balances ?? []).map(item => <CashCard key={item.branch} branch={item.branch} balance={item.balance} />)}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-semibold">حركة الكاش</CardTitle><p className="text-xs text-muted-foreground">{data?.rows.length ?? 0} حركة</p></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : error ? <div className="flex h-64 items-center justify-center text-sm text-destructive">تعذر تحميل حركة الكاش: {error.message}</div> : !data?.rows.length ? <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">لا توجد حركة ضمن الفلاتر المحددة</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30"><th className="px-3 py-3 text-right">التاريخ</th><th className="px-3 py-3 text-right">الفرع</th><th className="px-3 py-3 text-right">البيان</th><th className="px-3 py-3 text-right">صرف</th><th className="px-3 py-3 text-right">إيراد</th><th className="px-3 py-3 text-right">الرصيد</th></tr></thead>
                <tbody>{data.rows.map(row => <tr key={row.id} className="border-b border-border/40 hover:bg-muted/20"><td className="whitespace-nowrap px-3 py-2.5 text-xs">{row.date}</td><td className="px-3 py-2.5">{row.branch}</td><td className="max-w-[260px] truncate px-3 py-2.5 text-muted-foreground">{row.description || "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold text-red-600">{row.expense ? amount(row.expense) : "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold text-emerald-600">{row.income ? amount(row.income) : "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold">{amount(row.balance)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
