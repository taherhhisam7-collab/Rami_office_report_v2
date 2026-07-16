import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALERT_KEY = "receipts_welcome_alert_shown";

export default function WelcomeAlert() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // يظهر التنبيه في كل مرة يُفتح فيها التطبيق (لا يُحفظ في localStorage)
    // إذا أردت إظهاره مرة واحدة فقط، فعّل التعليق أدناه
    setIsOpen(true);
    // const shown = sessionStorage.getItem(ALERT_KEY);
    // if (!shown) setIsOpen(true);
  }, []);

  const handleConfirm = () => {
    sessionStorage.setItem(ALERT_KEY, "1");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)" }}
    >
      {/* Modal */}
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{
          animation: "alertIn 0.25s cubic-bezier(0.23, 1, 0.32, 1) both",
        }}
      >
        {/* شريط علوي ملوّن */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />

        <div className="p-6 text-right">
          {/* أيقونة التنبيه */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" strokeWidth={2} />
            </div>
          </div>

          {/* العنوان */}
          <h2 className="text-xl font-bold text-foreground text-center mb-3">
            تنبيه هام
          </h2>

          {/* النص */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <p className="text-sm text-amber-900 leading-relaxed text-center font-medium">
              يرجى التأكد من دقة البيانات المدخلة ومراجعتها جيداً قبل الحفظ لضمان صحة التقارير.
            </p>
          </div>

          {/* زر الموافقة */}
          <Button
            onClick={handleConfirm}
            className="w-full h-11 text-base font-bold rounded-xl gap-2"
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%)",
            }}
          >
            <CheckCircle2 className="h-5 w-5" />
            موافق، تم الاطلاع
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes alertIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
