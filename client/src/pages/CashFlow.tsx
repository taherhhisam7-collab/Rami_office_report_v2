import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, Calendar, Landmark, Loader2, MapPin, MoonStar, RefreshCw, Search, Wallet, Waves } from "lucide-react";
import { toast } from "sonner";

type Period = "all" | "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "quarter" | "year" | "custom";

const OWNER_EMAIL = "taherhhisam7@gmail.com";

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

function millisecondsUntilHour(hour: number) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
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
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (ر.س)`;
}

function wholeAmount(value: number) {
  return `${Math.ceil(value).toLocaleString("en-US")} (ر.س)`;
}

function branchIcon(branch: string) {
  if (branch.includes("\u062c\u062f\u0629")) return Landmark;
  if (branch.includes("\u0627\u0644\u062f\u0645\u0627\u0645")) return Waves;
  if (branch.includes("\u0627\u0644\u0631\u064a\u0627\u0636")) return Building2;
  if (branch.includes("\u0627\u0644\u0645\u062f\u064a\u0646\u0629")) return MoonStar;
  return MapPin;
}

function branchBadgeClass(branch: string) {
  if (branch.includes("جدة")) return "bg-emerald-100 text-emerald-700";
  if (branch.includes("الدمام")) return "bg-indigo-100 text-indigo-700";
  if (branch.includes("الرياض")) return "bg-teal-100 text-teal-700";
  if (branch.includes("المدينة")) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function HeaderTextFilter({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const active = Boolean(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          {label}
          <Search className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">فلترة {label}</label>
        <Input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-8 text-sm" />
      </PopoverContent>
    </Popover>
  );
}

function HeaderSelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const active = value !== "all";
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          {label}
          <span className="text-[10px]">⌄</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        <div className="space-y-1">
          {["all", ...options].map((option) => (
            <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={`block w-full rounded px-2 py-1.5 text-right text-xs hover:bg-muted ${value === option ? "bg-muted font-semibold text-primary" : ""}`}>
              {option === "all" ? `كل ${label}` : option}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CashCard({ branch, balance }: { branch: string; balance: number }) {
  const BranchIcon = branchIcon(branch);

  return (
    <Card className="border-2 border-black shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <BranchIcon className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-lg font-bold text-blue-700">{branch}</p>
        </div>
        <p className={`mt-3 text-xl font-bold ${balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : "text-muted-foreground"}`}>{wholeAmount(balance)}</p>
      </CardContent>
    </Card>
  );
}

function ActualBalances() {
  return (
    <Card className="border-2 border-black bg-orange-50/40 shadow-md">
      <CardContent className="p-3">
        <p className="text-center text-4xl font-bold text-blue-700">رصيد اليوم للفروع</p>
      </CardContent>
    </Card>
  );
}

export default function CashFlow() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);
  const syncDataMutation = trpc.sheets.syncMonth.useMutation({
    onSuccess: async () => {
      await utils.sheets.invalidate();
      toast.success("تم تحديث البيانات");
    },
    onError: () => toast.error("فشل تحديث البيانات"),
  });
  const [period, setPeriod] = useState<Period>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [branch, setBranch] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [expenseFilter, setExpenseFilter] = useState("");
  const [incomeFilter, setIncomeFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");
  useEffect(() => {
    const resetFilters = () => {
      setPeriod("all");
      setCustomStart("");
      setCustomEnd("");
      setBranch("all");
      setSearch("");
      setDateFilter("");
      setBranchFilter("all");
      setDescriptionFilter("");
      setExpenseFilter("");
      setIncomeFilter("");
      setBalanceFilter("");
    };
    let inactivityTimer: number | undefined;
    const armInactivityTimer = () => {
      if (inactivityTimer !== undefined) window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(resetFilters, 60 * 1000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) resetFilters();
      else armInactivityTimer();
    };
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach(event => window.addEventListener(event, armInactivityTimer, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", resetFilters);
    armInactivityTimer();
    return () => {
      if (inactivityTimer !== undefined) window.clearTimeout(inactivityTimer);
      activityEvents.forEach(event => window.removeEventListener(event, armInactivityTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", resetFilters);
    };
  }, []);
  const { startTs, endTs } = useMemo(() => getRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const cashFlowQuery = trpc.sheets.cashFlow.useQuery({
    branch: branch === "all" ? undefined : branch,
    startTs,
    endTs,
    search: search || undefined,
  }, { refetchInterval: false });
  const { data, isLoading, error } = cashFlowQuery;
  useEffect(() => {
    let intervalId: number | undefined;
    const refreshCashFlow = () => {
      if (user?.email === OWNER_EMAIL) {
        syncDataMutation.mutate({});
      } else {
        void cashFlowQuery.refetch();
      }
    };
    const timeoutId = window.setTimeout(() => {
      refreshCashFlow();
      intervalId = window.setInterval(refreshCashFlow, 24 * 60 * 60 * 1000);
    }, millisecondsUntilHour(10));
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [cashFlowQuery.refetch, syncDataMutation.mutate, user?.email]);
  const branchOptions = useMemo(() => data?.branches ?? Array.from(new Set((data?.rows ?? []).map(row => row.branch))), [data?.branches, data?.rows]);
  const filteredRows = useMemo(() => (data?.rows ?? []).filter(row => {
    const dateMatch = !dateFilter || row.date.includes(dateFilter);
    const branchMatch = branchFilter === "all" || row.branch === branchFilter;
    const descriptionMatch = !descriptionFilter || row.description.toLowerCase().includes(descriptionFilter.toLowerCase());
    const expenseMatch = !expenseFilter || String(row.expense).includes(expenseFilter);
    const incomeMatch = !incomeFilter || String(row.income).includes(incomeFilter);
    const balanceMatch = !balanceFilter || String(row.balance).includes(balanceFilter);
    return dateMatch && branchMatch && descriptionMatch && expenseMatch && incomeMatch && balanceMatch;
  }), [data?.rows, dateFilter, branchFilter, descriptionFilter, expenseFilter, incomeFilter, balanceFilter]);

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
                <button type="button" aria-label="اختيار تاريخ البداية" onClick={() => { const picker = startDatePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.click(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"><Calendar className="h-4 w-4" /></button>
                <input ref={startDatePickerRef} type="date" value={pickerValue(customStart)} onChange={event => { setCustomStart(formatPickedDate(event.target.value)); setPeriod("custom"); }} className="sr-only" tabIndex={-1} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">إلى تاريخ</label>
              <div className="relative">
                <Input type="text" inputMode="numeric" dir="ltr" placeholder="YYYY/MM/DD" maxLength={10} value={customEnd} onChange={event => { setCustomEnd(normalizeDate(event.target.value)); setPeriod("custom"); }} className="bg-background pr-10 text-right" />
                <button type="button" aria-label="اختيار تاريخ النهاية" onClick={() => { const picker = endDatePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.click(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"><Calendar className="h-4 w-4" /></button>
                <input ref={endDatePickerRef} type="date" value={pickerValue(customEnd)} onChange={event => { setCustomEnd(formatPickedDate(event.target.value)); setPeriod("custom"); }} className="sr-only" tabIndex={-1} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-orange-700">الفرع</label>
              <select value={branch} onChange={event => setBranch(event.target.value)} className="h-9 rounded-md border border-orange-400 bg-orange-50 px-3 text-sm text-orange-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="all">كل الفروع</option>
                {(data?.branches ?? []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">البحث</label>
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في البيان أو الفرع" className="bg-background pr-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <ActualBalances />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(data?.balances ?? []).map(item => <CashCard key={item.branch} branch={item.branch} balance={item.balance} />)}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-semibold">حركة الكاش</CardTitle><p className="text-xs text-muted-foreground">{filteredRows.length} حركة</p></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : error ? <div className="flex h-64 items-center justify-center text-sm text-destructive">تعذر تحميل حركة الكاش: {error.message}</div> : !filteredRows.length ? <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">لا توجد حركة ضمن الفلاتر المحددة</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30"><th className="px-3 py-3 text-right"><HeaderTextFilter label="التاريخ" value={dateFilter} onChange={setDateFilter} placeholder="مثال: 16/07/2026" /></th><th className="px-3 py-3 text-right"><HeaderSelectFilter label="الفرع" value={branchFilter} options={branchOptions} onChange={setBranchFilter} /></th><th className="px-3 py-3 text-right"><HeaderTextFilter label="البيان" value={descriptionFilter} onChange={setDescriptionFilter} placeholder="ابحث في البيان" /></th><th className="px-3 py-3 text-right"><HeaderTextFilter label="صرف" value={expenseFilter} onChange={setExpenseFilter} placeholder="ابحث بقيمة الصرف" /></th><th className="px-3 py-3 text-right"><HeaderTextFilter label="إيراد" value={incomeFilter} onChange={setIncomeFilter} placeholder="ابحث بقيمة الإيراد" /></th><th className="px-3 py-3 text-right"><HeaderTextFilter label="الرصيد" value={balanceFilter} onChange={setBalanceFilter} placeholder="ابحث بقيمة الرصيد" /></th></tr></thead>
                <tbody>{filteredRows.map(row => <tr key={row.id} className="border-b border-border/40 hover:bg-muted/20"><td className="whitespace-nowrap px-3 py-2.5 text-xs">{row.date}</td><td className="px-3 py-2.5"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${branchBadgeClass(row.branch)}`}>{row.branch}</span></td><td className="max-w-[260px] truncate px-3 py-2.5 text-muted-foreground">{row.description || "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold text-red-600">{row.expense ? amount(row.expense) : "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold text-emerald-600">{row.income ? amount(row.income) : "—"}</td><td className="whitespace-nowrap px-3 py-2.5 font-semibold">{amount(row.balance)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
