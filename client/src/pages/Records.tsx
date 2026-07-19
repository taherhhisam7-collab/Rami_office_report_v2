import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Loader2, Search, X, Download, Filter,
  ChevronRight, ChevronLeft, ChevronDown, Check,
  ArrowUp, ArrowDown, ArrowUpDown, Calendar, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ===== أنواع الفترات الزمنية =====
type Period = "all" | "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "quarter" | "year" | "custom";
type SortDir = "desc" | "asc";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "all",        label: "كل الفترات" },
  { value: "today",      label: "اليوم" },
  { value: "yesterday",  label: "أمس" },
  { value: "week",       label: "هذا الأسبوع" },
  { value: "last_week",  label: "الأسبوع الماضي" },
  { value: "month",      label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "quarter",    label: "هذا الربع" },
  { value: "year",       label: "هذه السنة" },
  { value: "custom",     label: "نطاق مخصص" },
];

// خريطة الشهور العربية
const ARABIC_MONTHS_REC: Record<number, string> = {
  1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل", 5: "مايو", 6: "يونيو",
  7: "يوليو", 8: "أغسطس", 9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر",
};

function normalizeDateInput(value: string) {
  const westernDigits = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const digits = westernDigits.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(value?: string) {
  if (!value) return undefined;
  const parts = value.split(/[/-]/).map(Number);
  const dayFirst = /^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value);
  const yearFirst = /^\d{4}[/-]\d{2}[/-]\d{2}$/.test(value);
  if (!dayFirst && !yearFirst) return undefined;
  const [year, month, day] = yearFirst ? parts : [parts[2], parts[1], parts[0]];
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
}

function formatDateValue(timestamp?: number) {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function pickerValue(value?: string) {
  const date = parseDateInput(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatPickedDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { startTs?: number; endTs?: number; month?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (period) {
    case "all":      return {};
    case "today":    return { startTs: today.getTime(), endTs: endOfDay(today).getTime() };
    case "yesterday": { const y = new Date(today); y.setDate(y.getDate() - 1); return { startTs: y.getTime(), endTs: endOfDay(y).getTime() }; }
    case "week": { const day = today.getDay(); const diff = day === 0 ? 6 : day - 1; const start = new Date(today); start.setDate(start.getDate() - diff); return { startTs: start.getTime(), endTs: endOfDay(today).getTime() }; }
    case "last_week": { const day = today.getDay(); const diff = day === 0 ? 6 : day - 1; const thisWeekStart = new Date(today); thisWeekStart.setDate(thisWeekStart.getDate() - diff); const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7); const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); return { startTs: lastWeekStart.getTime(), endTs: endOfDay(lastWeekEnd).getTime() }; }
    case "month": {
      // إرسال اسم الشهر العربي مباشرة — يُحمَّل تبويب الشهر كاملاً
      return { month: ARABIC_MONTHS_REC[now.getMonth() + 1] };
    }
    case "last_month": {
      // الشهر السابق بالاسم العربي مباشرة
      const prevIdx = now.getMonth() === 0 ? 12 : now.getMonth();
      return { month: ARABIC_MONTHS_REC[prevIdx] };
    }
    case "quarter": { const q = Math.floor(now.getMonth() / 3); const start = new Date(now.getFullYear(), q * 3, 1); return { startTs: start.getTime(), endTs: endOfDay(today).getTime() }; }
    case "year": { const start = new Date(now.getFullYear(), 0, 1); return { startTs: start.getTime(), endTs: endOfDay(today).getTime() }; }
    case "custom": {
      const start = parseDateInput(customStart);
      const end = parseDateInput(customEnd);
      return { startTs: start?.getTime(), endTs: end ? endOfDay(end).getTime() : undefined };
    }
    default: return {};
  }
}

function formatAmountFull(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

function exportToCSV(records: any[]) {
  const headers = ["رقم السند", "التاريخ", "الفرع", "اسم العميل", "الخدمة", "المبلغ", "طريقة الدفع", "الموظف", "ملاحظات"];
  const rows = records.map((r) => [r.receiptNo, r.date, r.branch, r.customerName, r.service, r.amount, r.paymentMethod, r.employee, r.notes]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `سجلات_القبض_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const BRANCH_COLORS: Record<string, string> = {
  "جدة":     "bg-emerald-100 text-emerald-700",
  "الدمام":  "bg-indigo-100 text-indigo-700",
  "الرياض":  "bg-teal-100 text-teal-700",
  "المدينة": "bg-amber-100 text-amber-700",
};
const PAYMENT_COLORS: Record<string, string> = {
  "الأهلي":  "bg-green-100 text-green-700",
  "الرياض":  "bg-blue-100 text-blue-700",
  "الإنماء": "bg-purple-100 text-purple-700",
  "مدى":     "bg-orange-100 text-orange-700",
  "كاش":     "bg-yellow-100 text-yellow-700",
  "نقداً":   "bg-yellow-100 text-yellow-700",
};

function BranchBadge({ branch }: { branch: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${BRANCH_COLORS[branch] ?? "bg-gray-100 text-gray-700"}`}>{branch}</span>;
}
function PaymentBadge({ method }: { method: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${PAYMENT_COLORS[method] ?? "bg-gray-100 text-gray-600"}`}>{method || "—"}</span>;
}
function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent></Card>
  );
}

// ===== مكوّن فلتر رأس العمود (Excel-style) =====
interface ColFilterProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  allLabel?: string;
  minWidth?: string;
}
function ColFilter({ label, value, options, onChange, allLabel = "الكل", minWidth = "160px" }: ColFilterProps) {
  const [open, setOpen] = useState(false);
  const isActive = value !== "all";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 group transition-colors rounded px-1 py-0.5 -mx-1 ${
            isActive
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs font-semibold">{label}</span>
          {isActive
            ? <Check className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ minWidth }} align="start">
        <Command>
          <CommandInput placeholder={`بحث في ${label}...`} className="text-sm" />
          <CommandList>
            <CommandEmpty>لا توجد نتائج</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => { onChange("all"); setOpen(false); }}
                className="text-sm"
              >
                <Check className={`ml-2 h-3.5 w-3.5 ${value === "all" ? "opacity-100 text-primary" : "opacity-0"}`} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={(v) => { onChange(v === value ? "all" : v); setOpen(false); }}
                  className="text-sm"
                >
                  <Check className={`ml-2 h-3.5 w-3.5 ${value === opt ? "opacity-100 text-primary" : "opacity-0"}`} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ===== مكوّن فلتر المبلغ (نطاق رقمي) =====
interface AmountFilterProps {
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  isActive: boolean;
}
function AmountFilter({ minVal, maxVal, onMinChange, onMaxChange, isActive }: AmountFilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 group transition-colors rounded px-1 py-0.5 -mx-1 ${
            isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs font-semibold">المبلغ</span>
          {isActive
            ? <Check className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-52" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">نطاق المبلغ (ر.س)</p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">من</label>
            <Input
              type="number"
              placeholder="0"
              value={minVal}
              onChange={(e) => onMinChange(e.target.value)}
              className="h-8 text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">إلى</label>
            <Input
              type="number"
              placeholder="غير محدود"
              value={maxVal}
              onChange={(e) => onMaxChange(e.target.value)}
              className="h-8 text-sm mt-0.5"
            />
          </div>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => { onMinChange(""); onMaxChange(""); setOpen(false); }}
            >
              <X className="h-3 w-3 ml-1" /> مسح الفلتر
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ===== مكوّن فلتر رقم السند (بحث نصي في الرأس) =====
interface ReceiptNoFilterProps {
  value: string;
  onChange: (v: string) => void;
}
function ReceiptNoFilter({ value, onChange }: ReceiptNoFilterProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  const isActive = !!value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 group transition-colors rounded px-1 py-0.5 -mx-1 ${
            isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs font-semibold">رقم السند</span>
          {isActive
            ? <Check className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-52" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">بحث برقم السند</p>
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="مثال: 7723"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm pr-8"
          />
          {value && (
            <button onClick={() => { onChange(""); setOpen(false); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ===== مكوّن فلتر اسم العميل (بحث نصي في الرأس) =====
function CustomerFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  const isActive = !!value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 group transition-colors rounded px-1 py-0.5 -mx-1 ${
            isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="text-xs font-semibold">اسم العميل</span>
          {isActive
            ? <Check className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-52" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-2">بحث باسم العميل</p>
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            placeholder="اكتب اسم العميل..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm pr-8"
          />
          {value && (
            <button onClick={() => { onChange(""); setOpen(false); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ===== مكوّن فرز التاريخ =====
function DateSortButton({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 group transition-colors rounded px-1 py-0.5 -mx-1 text-muted-foreground hover:text-foreground"
      title={dir === "desc" ? "مرتب تنازلياً — اضغط للتصاعدي" : "مرتب تصاعدياً — اضغط للتنازلي"}
    >
      <span className="text-xs font-semibold">التاريخ</span>
      {dir === "desc"
        ? <ArrowDown className="h-3 w-3 text-primary" />
        : <ArrowUp className="h-3 w-3 text-primary" />
      }
    </button>
  );
}

// ===== الصفحة الرئيسية =====
export default function Records() {
  const utils = trpc.useUtils();
  const syncDataMutation = trpc.sheets.syncMonth.useMutation({
    onSuccess: async () => {
      await utils.sheets.invalidate();
      toast.success("تم تحديث البيانات");
    },
    onError: () => toast.error("فشل تحديث البيانات"),
  });

  // ===== فلاتر الشريط العلوي =====
  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ===== فلاتر رؤوس الجدول (Excel-style) =====
  const [colReceiptNo, setColReceiptNo] = useState("");
  const [colBranch, setColBranch] = useState("all");
  const [colCustomer, setColCustomer] = useState("");
  const [colService, setColService] = useState("all");
  const [colPayment, setColPayment] = useState("all");
  const [colEmployee, setColEmployee] = useState("all");
  const [colAmountMin, setColAmountMin] = useState("");
  const [colAmountMax, setColAmountMax] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const resetPage = useCallback(() => setPage(1), []);

  const { startTs, endTs, month: periodMonth } = useMemo(() => getPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);

  const resolvedMonth = periodMonth;
  // resolvedMonthYear: الشكل الجديد "شهر-سنة" للإرسال للخادم
  const resolvedMonthYear = useMemo(() => {
    if (startTs || endTs) return undefined; // فترة مخصصة — لا نرسل monthYear
    if (!resolvedMonth) return undefined;
    const now = new Date();
    const MONTHS_MAP: Record<string, number> = { "يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"سبتمبر":9,"أكتوبر":10,"نوفمبر":11,"ديسمبر":12 };
    const mNum = MONTHS_MAP[resolvedMonth];
    if (!mNum) return undefined;
    const year = mNum > (now.getMonth() + 1) ? now.getFullYear() - 1 : now.getFullYear();
    return `${resolvedMonth}-${year}`;
  }, [resolvedMonth, startTs, endTs]);

  const queryInput = useMemo(() => ({
    startTs,
    endTs,
    branch: colBranch !== "all" ? colBranch : undefined,
    paymentMethod: colPayment !== "all" ? colPayment : undefined,
    employee: colEmployee !== "all" ? colEmployee : undefined,
    service: colService !== "all" ? colService : undefined,
    monthYear: resolvedMonthYear,
    search: search || undefined,
    receiptNoFilter: colReceiptNo.trim() || undefined,
    customerFilter: colCustomer.trim() || undefined,
    amountMin: colAmountMin !== "" ? parseFloat(colAmountMin) : undefined,
    amountMax: colAmountMax !== "" ? parseFloat(colAmountMax) : undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [startTs, endTs, colBranch, colPayment, colEmployee, colService, resolvedMonthYear, search, colReceiptNo, colCustomer, colAmountMin, colAmountMax, page]);

  const recordsQuery = trpc.sheets.records.useQuery(queryInput, { refetchInterval: false });
  const filterOptionsQuery = trpc.sheets.filterOptions.useQuery({ monthYear: resolvedMonthYear }, { refetchInterval: false });
  const { data: rawData, isLoading, error } = recordsQuery;
  const { data: filterOpts } = filterOptionsQuery;
  useEffect(() => {
    const resetFilters = () => {
      setPeriod("all");
      setCustomStart("");
      setCustomEnd("");
      setSearch("");
      setColReceiptNo("");
      setColBranch("all");
      setColCustomer("");
      setColService("all");
      setColPayment("all");
      setColEmployee("all");
      setColAmountMin("");
      setColAmountMax("");
      setSortDir("desc");
      resetPage();
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
  }, [resetPage]);
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void recordsQuery.refetch();
      void filterOptionsQuery.refetch();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [recordsQuery.refetch, filterOptionsQuery.refetch]);
  const { data: monthInfo } = trpc.sheets.currentMonth.useQuery();

  // ===== فرز على الـ client فقط (الفلاتر كلها على الخادم) =====
  const data = useMemo(() => {
    if (!rawData) return rawData;
    let records = [...rawData.records];
    // الفرز حسب التاريخ
    records.sort((a, b) => {
      const ta = a.dateTs ?? 0;
      const tb = b.dateTs ?? 0;
      return sortDir === "desc" ? tb - ta : ta - tb;
    });
    // البطاقات تستخدم مجاميع الخادم (كل الصفحات)
    return { ...rawData, records };
  }, [rawData, sortDir]);

  const colFiltersActive = [colReceiptNo, colCustomer, colAmountMin, colAmountMax].some(Boolean)
    || [colBranch, colService, colPayment, colEmployee].some((v) => v !== "all");

  const topFiltersActive = [
    period !== "month", !!search,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setPeriod("month"); setCustomStart(""); setCustomEnd("");
    setSearch(""); setPage(1);
    setColReceiptNo(""); setColBranch("all"); setColCustomer("");
    setColService("all"); setColPayment("all"); setColEmployee("all");
    setColAmountMin(""); setColAmountMax("");
  };

  const activeFiltersCount = topFiltersActive + (colFiltersActive ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* ===== الرأس ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">سجلات السندات</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            فلاتر متقدمة داخل رؤوس الجدول
            {data && ` — ${data.total.toLocaleString("ar-SA")} سجل`}
          </p>
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
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-destructive hover:text-destructive flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> مسح كل الفلاتر
              <Badge variant="secondary" className="mr-1 text-xs">{activeFiltersCount}</Badge>
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => data && exportToCSV(data.records)}
            disabled={!data || data.records.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* ===== لوحة الفلاتر العلوية ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            فلاتر الفترة الزمنية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { const range = getPeriodRange(opt.value); setCustomStart(formatDateValue(range.startTs)); setCustomEnd(formatDateValue(range.endTs)); setPeriod(opt.value); resetPage(); }}
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
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">من تاريخ</label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="YYYY/MM/DD"
                    maxLength={10}
                    value={customStart}
                    onChange={(e) => { setCustomStart(normalizeDateInput(e.target.value)); setPeriod("custom"); resetPage(); }}
                    className="bg-background pr-10 text-right"
                  />
                  <button
                    type="button"
                    aria-label="اختيار تاريخ البداية"
                    onClick={() => {
                      const picker = startDatePickerRef.current;
                      if (picker?.showPicker) picker.showPicker();
                      else picker?.click();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <input
                    ref={startDatePickerRef}
                    type="date"
                    value={pickerValue(customStart)}
                    onChange={(e) => { setCustomStart(formatPickedDate(e.target.value)); setPeriod("custom"); resetPage(); }}
                    className="sr-only"
                    tabIndex={-1}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">إلى تاريخ</label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="YYYY/MM/DD"
                    maxLength={10}
                    value={customEnd}
                    onChange={(e) => { setCustomEnd(normalizeDateInput(e.target.value)); setPeriod("custom"); resetPage(); }}
                    className="bg-background pr-10 text-right"
                  />
                  <button
                    type="button"
                    aria-label="اختيار تاريخ النهاية"
                    onClick={() => {
                      const picker = endDatePickerRef.current;
                      if (picker?.showPicker) picker.showPicker();
                      else picker?.click();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                  <input
                    ref={endDatePickerRef}
                    type="date"
                    value={pickerValue(customEnd)}
                    onChange={(e) => { setCustomEnd(formatPickedDate(e.target.value)); setPeriod("custom"); resetPage(); }}
                    className="sr-only"
                    tabIndex={-1}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* البحث النصي العام */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث عام في الاسم، رقم السند، الخدمة، الموظف، الملاحظات..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="pr-9 bg-background"
            />
            {search && (
              <button onClick={() => { setSearch(""); resetPage(); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== بطاقات الملخص ===== */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="إجمالي المبالغ" value={formatAmountFull(data.totalAmount)} />
          <SummaryCard label="عدد السندات" value={data.total.toLocaleString("ar-SA")} />
          <SummaryCard label="متوسط السند" value={data.total > 0 ? formatAmountFull(data.totalAmount / data.total) : "—"} />
          <SummaryCard label="الصفحة" value={`${rawData?.page ?? 1} / ${rawData?.totalPages || 1}`} sub={`${PAGE_SIZE} سجل في الصفحة`} />
        </div>
      )}

      {/* ===== شريط الفلاتر السريعة (Dropdown) ===== */}
      {filterOpts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* الفرع */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">الفرع</label>
            <select
              value={colBranch}
              onChange={(e) => { setColBranch(e.target.value); resetPage(); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-right"
            >
              <option value="all">كل الفروع</option>
              {(filterOpts.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {/* طريقة الدفع */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">طريقة الدفع</label>
            <select
              value={colPayment}
              onChange={(e) => { setColPayment(e.target.value); resetPage(); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-right"
            >
              <option value="all">كل الطرق</option>
              {(filterOpts.paymentMethods ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {/* الموظف */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">الموظف</label>
            <select
              value={colEmployee}
              onChange={(e) => { setColEmployee(e.target.value); resetPage(); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-right"
            >
              <option value="all">كل الموظفين</option>
              {(filterOpts.employees ?? []).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          {/* الخدمة */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">الخدمة</label>
            <select
              value={colService}
              onChange={(e) => { setColService(e.target.value); resetPage(); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-right"
            >
              <option value="all">كل الخدمات</option>
              {(filterOpts.services ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ===== الجدول مع فلاتر الرؤوس ===== */}
      <Card>
        {colFiltersActive && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">فلاتر الجدول نشطة</span>
            <button
              onClick={() => { setColReceiptNo(""); setColBranch("all"); setColCustomer(""); setColService("all"); setColPayment("all"); setColEmployee("all"); setColAmountMin(""); setColAmountMax(""); }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mr-auto"
            >
              <X className="h-3 w-3" /> مسح فلاتر الجدول
            </button>
          </div>
        )}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-destructive text-sm">تعذّر تحميل البيانات: {error.message}</div>
          ) : !data || data.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-sm">لا توجد سجلات تطابق الفلاتر المحددة</p>
              {activeFiltersCount > 0 && <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">مسح الفلاتر</button>}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {/* رقم السند */}
                      <th className="text-right py-3 px-3">
                        <ReceiptNoFilter value={colReceiptNo} onChange={(v) => { setColReceiptNo(v); resetPage(); }} />
                      </th>
                      {/* التاريخ - فرز فقط */}
                      <th className="text-right py-3 px-3">
                        <DateSortButton dir={sortDir} onToggle={() => setSortDir((d) => d === "desc" ? "asc" : "desc")} />
                      </th>
                      {/* الفرع */}
                      <th className="text-right py-3 px-3">
                        <ColFilter
                          label="الفرع"
                          value={colBranch}
                          options={filterOpts?.branches ?? []}
                          onChange={(v) => { setColBranch(v); resetPage(); }}
                          allLabel="كل الفروع"
                          minWidth="140px"
                        />
                      </th>
                      {/* اسم العميل */}
                      <th className="text-right py-3 px-3">
                        <CustomerFilter value={colCustomer} onChange={(v) => { setColCustomer(v); resetPage(); }} />
                      </th>
                      {/* الخدمة */}
                      <th className="text-right py-3 px-3">
                        <ColFilter
                          label="الخدمة"
                          value={colService}
                          options={filterOpts?.services ?? []}
                          onChange={(v) => { setColService(v); resetPage(); }}
                          allLabel="كل الخدمات"
                          minWidth="180px"
                        />
                      </th>
                      {/* المبلغ */}
                      <th className="text-right py-3 px-3">
                        <AmountFilter
                          minVal={colAmountMin}
                          maxVal={colAmountMax}
                          onMinChange={(v) => { setColAmountMin(v); resetPage(); }}
                          onMaxChange={(v) => { setColAmountMax(v); resetPage(); }}
                          isActive={!!(colAmountMin || colAmountMax)}
                        />
                      </th>
                      {/* طريقة الدفع */}
                      <th className="text-right py-3 px-3">
                        <ColFilter
                          label="طريقة الدفع"
                          value={colPayment}
                          options={filterOpts?.paymentMethods ?? []}
                          onChange={(v) => { setColPayment(v); resetPage(); }}
                          allLabel="كل الطرق"
                          minWidth="160px"
                        />
                      </th>
                      {/* الموظف */}
                      <th className="text-right py-3 px-3">
                        <ColFilter
                          label="الموظف"
                          value={colEmployee}
                          options={filterOpts?.employees ?? []}
                          onChange={(v) => { setColEmployee(v); resetPage(); }}
                          allLabel="كل الموظفين"
                          minWidth="160px"
                        />
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r, i) => (
                      <tr
                        key={`${r.receiptNo}-${r.branch}-${i}`}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{r.receiptNo || "—"}</td>
                        <td className="py-2.5 px-3 text-xs whitespace-nowrap">{r.date || "—"}</td>
                        <td className="py-2.5 px-3"><BranchBadge branch={r.branch} /></td>
                        <td className="py-2.5 px-3 font-medium max-w-[160px] truncate">{r.customerName || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[140px] truncate">{r.service || "—"}</td>
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{r.amount.toLocaleString("ar-SA")} ر.س</td>
                        <td className="py-2.5 px-3"><PaymentBadge method={r.paymentMethod} /></td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{r.employee || "—"}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[120px] truncate" title={r.notes ?? undefined}>{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ترقيم الصفحات */}
              {rawData && rawData.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {((page - 1) * PAGE_SIZE) + 1} – {Math.min(page * PAGE_SIZE, rawData.total)} من {rawData.total.toLocaleString("ar-SA")} سجل
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(5, rawData.totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(rawData.totalPages - 4, page - 2)) + i;
                      return (
                        <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className="h-8 w-8 p-0 text-xs">{p}</Button>
                      );
                    })}
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(rawData.totalPages, p + 1))} disabled={page === rawData.totalPages} className="h-8 w-8 p-0">
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
