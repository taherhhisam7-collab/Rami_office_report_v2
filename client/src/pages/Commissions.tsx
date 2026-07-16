import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Plus, Pencil, Trash2, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// ===== ثوابت =====
const OWNER_EMAIL = "taherhhisam7@gmail.com";
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const BRANCHES = ["كل الفروع", "جدة", "الدمام", "الرياض", "المدينة"];

function getCurrentArabicMonth(): string {
  return ARABIC_MONTHS[new Date().getMonth()];
}

function fmt(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// ===== تصدير Excel =====
function exportToExcel(
  report: Array<{
    employeeName: string;
    totalWithTax: number;
    taxAmount: number;
    amountAfterTax: number;
    rate: number;
    commissionAmount: number;
  }>,
  month: string,
  totalCommission: number
) {
  const headers = ["اسم الموظف", "المبلغ شامل الضريبة", "الضريبة", "المبلغ بعد", "نسبة العمولة", "مبلغ العمولة"];
  const rows = report.map((r) => [
    r.employeeName,
    r.totalWithTax,
    r.taxAmount,
    r.amountAfterTax,
    `${r.rate}%`,
    r.commissionAmount,
  ]);
  rows.push(["المجموع", "", "", "", "", totalCommission]);

  // بناء CSV بترتيب RTL
  const csvContent = [
    `عمولات الموظفين شهر ${month}`,
    headers.join("\t"),
    ...rows.map((r) => r.join("\t")),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عمولات_الموظفين_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== مكوّن إدارة الموظفين =====
interface ManageEmployeesDialogProps {
  open: boolean;
  onClose: () => void;
}
function ManageEmployeesDialog({ open, onClose }: ManageEmployeesDialogProps) {
  const utils = trpc.useUtils();
  const { data: rates, isLoading } = trpc.commissions.getRates.useQuery();

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [addName, setAddName] = useState("");
  const [addRate, setAddRate] = useState("");

  const updateMut = trpc.commissions.updateEmployee.useMutation({
    onSuccess: () => {
      utils.commissions.getRates.invalidate();
      utils.commissions.getReport.invalidate();
      setEditId(null);
      toast.success("تم التحديث بنجاح");
    },
  });
  const deleteMut = trpc.commissions.deleteEmployee.useMutation({
    onSuccess: () => {
      utils.commissions.getRates.invalidate();
      utils.commissions.getReport.invalidate();
      toast.success("تم الحذف");
    },
  });
  const addMut = trpc.commissions.addEmployee.useMutation({
    onSuccess: () => {
      utils.commissions.getRates.invalidate();
      utils.commissions.getReport.invalidate();
      setAddName("");
      setAddRate("");
      toast.success("تمت الإضافة بنجاح");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            إدارة الموظفين ونسب العمولات
          </DialogTitle>
        </DialogHeader>

        {/* إضافة موظف جديد */}
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">إضافة موظف جديد</p>
          <div className="flex gap-2">
            <Input
              placeholder="اسم الموظف"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="flex-1 text-sm"
            />
            <Input
              placeholder="النسبة %"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={addRate}
              onChange={(e) => setAddRate(e.target.value)}
              className="w-24 text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!addName.trim() || !addRate) return;
                addMut.mutate({ employeeName: addName.trim(), rate: parseFloat(addRate) });
              }}
              disabled={addMut.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* قائمة الموظفين */}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">جارٍ التحميل...</p>}
          {rates?.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
              {editId === emp.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-20 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => updateMut.mutate({ id: emp.id, employeeName: editName, rate: parseFloat(editRate), isActive: emp.isActive })}
                    disabled={updateMut.isPending}
                  >
                    حفظ
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditId(null)}>
                    إلغاء
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{emp.employeeName}</span>
                  <Badge variant="secondary" className="text-xs">{String(emp.rate)}%</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setEditId(emp.id); setEditName(emp.employeeName); setEditRate(String(emp.rate)); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMut.mutate({ id: emp.id })}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== الصفحة الرئيسية =====
export default function Commissions() {
  const { user } = useAuth();
  const tableRef = useRef<HTMLDivElement>(null);

  // حماية: المالك فقط
  if (!user || user.email !== OWNER_EMAIL) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">غير مصرح لك بالوصول إلى هذه الصفحة.</p>
      </div>
    );
  }

  // ===== فلاتر =====
  const [selectedMonth, setSelectedMonth] = useState(getCurrentArabicMonth());
  const [selectedBranch, setSelectedBranch] = useState("كل الفروع");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [manageOpen, setManageOpen] = useState(false);

  const queryInput = useMemo(() => ({
    month: selectedMonth,
    branch: selectedBranch !== "كل الفروع" ? selectedBranch : undefined,
    employeeName: selectedEmployee !== "all" ? selectedEmployee : undefined,
  }), [selectedMonth, selectedBranch, selectedEmployee]);

  const { data, isLoading, refetch } = trpc.commissions.getReport.useQuery(queryInput);
  const { data: rates } = trpc.commissions.getRates.useQuery();

  const employeeOptions = useMemo(() => rates?.map((r) => r.employeeName) ?? [], [rates]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* ===== الرأس ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">عمولات الموظفين الشهرية</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            تقرير العمولات — شهر {selectedMonth}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            إدارة الموظفين
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!data) return;
              exportToExcel(data.report, data.month, data.totalCommission);
              toast.success("تم تصدير التقرير بنجاح");
            }}
            disabled={!data || data.report.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* ===== فلاتر ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">فلاتر التقرير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* الشهر */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الشهر</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARABIC_MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الفرع */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الموظف */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الموظف</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="كل الموظفين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموظفين</SelectItem>
                  {employeeOptions.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== الجدول ===== */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">جارٍ تحميل بيانات العمولات...</p>
              </div>
            </div>
          ) : (
            <div ref={tableRef} className="overflow-x-auto">
              {/* عنوان الجدول */}
              <div className="bg-[#1a3a5c] text-white text-center py-3 px-4 font-bold text-lg rounded-t-lg">
                عمولات الموظفين شهر {data?.month ?? selectedMonth} {new Date().getFullYear()}
              </div>

              <table className="w-full text-sm border-collapse" dir="rtl">
                {/* رؤوس الأعمدة */}
                <thead>
                  <tr className="bg-[#d4a017] text-[#1a3a5c] font-bold">
                    <th className="border border-[#c8960e] px-4 py-2.5 text-right">اسم الموظف</th>
                    <th className="border border-[#c8960e] px-4 py-2.5 text-center">المبلغ شامل الضريبة</th>
                    <th className="border border-[#c8960e] px-4 py-2.5 text-center">الضريبة</th>
                    <th className="border border-[#c8960e] px-4 py-2.5 text-center">المبلغ بعد</th>
                    <th className="border border-[#c8960e] px-4 py-2.5 text-center">نسبة العمولة</th>
                    <th className="border border-[#c8960e] px-4 py-2.5 text-center">مبلغ العمولة</th>
                  </tr>
                </thead>

                <tbody>
                  {data?.report.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}
                    >
                      <td className="border border-gray-300 px-4 py-2 text-right font-medium text-[#1a3a5c]">
                        {row.employeeName}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {row.totalWithTax > 0 ? fmt(row.totalWithTax) : "0"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {row.totalWithTax > 0 ? fmt(row.taxAmount) : "0"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {row.totalWithTax > 0 ? fmt(row.amountAfterTax) : "0"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold text-[#1a3a5c]">
                        {row.rate}%
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold">
                        {fmt(row.commissionAmount)}
                      </td>
                    </tr>
                  ))}

                  {/* صف المجموع */}
                  {data && (
                    <tr className="bg-[#f0e040] font-bold">
                      <td className="border border-gray-400 px-4 py-2.5 text-right text-[#1a3a5c] text-base">
                        المجموع
                      </td>
                      <td className="border border-gray-400 px-4 py-2.5 text-center" colSpan={4} />
                      <td className="border border-gray-400 px-4 py-2.5 text-center text-[#1a3a5c] text-base">
                        {fmt(data.totalCommission)}
                      </td>
                    </tr>
                  )}

                  {/* حالة فارغة */}
                  {data && data.report.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد بيانات لهذا الشهر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== ملاحظة الضريبة ===== */}
      <p className="text-xs text-muted-foreground text-center">
        * جميع المبالغ شاملة ضريبة القيمة المضافة 15% — يتم خصم الضريبة قبل احتساب العمولة
      </p>

      {/* ===== نافذة إدارة الموظفين ===== */}
      <ManageEmployeesDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
