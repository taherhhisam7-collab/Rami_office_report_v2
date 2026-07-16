/**
 * بيانات أولية حقيقية مستخرجة من جداول سندات القبض للفروع الأربعة.
 * التواريخ بصيغة YYYY-MM-DD، والمبالغ بالريال السعودي.
 */
export type SeedReceipt = {
  receiptNo: string;
  date: string; // YYYY-MM-DD
  branch: string;
  customerName: string;
  service: string;
  amount: number;
  paymentMethod: string;
  employee?: string;
  notes?: string;
};

export const SEED_RECEIPTS: SeedReceipt[] = [
  // ===== فرع الدمام =====
  { receiptNo: "9354", date: "2026-06-07", branch: "الدمام", customerName: "محمد ناجد نايف الهاجري", service: "دفعة من الأتعاب", amount: 5000, paymentMethod: "الرياض" },
  { receiptNo: "9355", date: "2026-06-07", branch: "الدمام", customerName: "عبدالرحمن الأحمدي", service: "استشارة", amount: 250, paymentMethod: "الإنماء" },
  { receiptNo: "9356", date: "2026-06-07", branch: "الدمام", customerName: "ايمان بوشعيب", service: "مقدم عقد جديد", amount: 10000, paymentMethod: "الأهلي" },
  { receiptNo: "9357", date: "2026-06-07", branch: "الدمام", customerName: "ايمان اليوسف", service: "استشارة", amount: 250, paymentMethod: "مدى" },
  { receiptNo: "9358", date: "2026-06-07", branch: "الدمام", customerName: "فهد منصور", service: "مبلغ وكالة", amount: 1500, paymentMethod: "الأهلي", notes: "استخراج وكالة" },
  { receiptNo: "9359", date: "2026-06-07", branch: "الدمام", customerName: "يوسف ابراهيم", service: "باقي الأتعاب", amount: 500, paymentMethod: "نقداً" },
  { receiptNo: "9360", date: "2026-06-08", branch: "الدمام", customerName: "ايهاب محمد سعيد خياط", service: "باقي الأتعاب", amount: 10000, paymentMethod: "الأهلي" },
  { receiptNo: "9361", date: "2026-06-08", branch: "الدمام", customerName: "حسن الغامدي", service: "استشارة", amount: 250, paymentMethod: "مدى" },
  { receiptNo: "9362", date: "2026-06-08", branch: "الدمام", customerName: "احمد علي احمد الغامدي", service: "دفعة من الأتعاب", amount: 1000, paymentMethod: "نقداً" },
  { receiptNo: "9363", date: "2026-06-09", branch: "الدمام", customerName: "ناصر الياسي", service: "استشارة", amount: 250, paymentMethod: "الرياض" },
  { receiptNo: "9364", date: "2026-06-09", branch: "الدمام", customerName: "ايات عادل", service: "استشارة", amount: 250, paymentMethod: "مدى" },
  { receiptNo: "9365", date: "2026-06-09", branch: "الدمام", customerName: "راكن علي", service: "استشارة", amount: 250, paymentMethod: "الأهلي" },
  { receiptNo: "9366", date: "2026-06-09", branch: "الدمام", customerName: "ايهاب محمد سعيد خياط", service: "مقدم عقد جديد", amount: 10000, paymentMethod: "الأهلي" },
  { receiptNo: "9367", date: "2026-06-10", branch: "الدمام", customerName: "ايات عادل احمد المصلي", service: "مقدم عقد جديد", amount: 8000, paymentMethod: "مدى" },
  { receiptNo: "9368", date: "2026-06-10", branch: "الدمام", customerName: "الجوهرة", service: "استشارة", amount: 250, paymentMethod: "الإنماء" },
  { receiptNo: "9369", date: "2026-06-10", branch: "الدمام", customerName: "محمد عبدالله صالح العامر", service: "مقدم عقد جديد", amount: 3500, paymentMethod: "الإنماء" },
  { receiptNo: "9370", date: "2026-06-10", branch: "الدمام", customerName: "محمد عبدالله صالح العامر", service: "مقدم عقد جديد", amount: 1500, paymentMethod: "نقداً" },
  { receiptNo: "9371", date: "2026-06-11", branch: "الدمام", customerName: "مصطفى سعود سنوسي محروس", service: "مقدم عقد جديد", amount: 6000, paymentMethod: "الرياض" },
  { receiptNo: "9372", date: "2026-06-11", branch: "الدمام", customerName: "احمد خالد احمد الهلال", service: "دفعة من الأتعاب", amount: 5000, paymentMethod: "الرياض" },
  { receiptNo: "9373", date: "2026-06-11", branch: "الدمام", customerName: "فايز", service: "استشارة", amount: 250, paymentMethod: "نقداً" },
  { receiptNo: "9374", date: "2026-06-14", branch: "الدمام", customerName: "جهاد المرزوق", service: "استشارة", amount: 250, paymentMethod: "الأهلي" },
  { receiptNo: "9375", date: "2026-06-14", branch: "الدمام", customerName: "سعود سويلم السعيد", service: "دفعة من الأتعاب", amount: 4500, paymentMethod: "الأهلي", notes: "500 وكالة موثق" },
  { receiptNo: "9376", date: "2026-06-14", branch: "الدمام", customerName: "احمد علي احمد الغامدي", service: "باقي الأتعاب", amount: 1000, paymentMethod: "نقداً" },
  { receiptNo: "9377", date: "2026-06-14", branch: "الدمام", customerName: "ايمان محمد", service: "وكالة موثق", amount: 1500, paymentMethod: "الأهلي" },
  { receiptNo: "9378", date: "2026-06-15", branch: "الدمام", customerName: "محمد ناجد نايف الهاجري", service: "باقي علد الأتعاب", amount: 5000, paymentMethod: "الإنماء" },
  { receiptNo: "9379", date: "2026-06-15", branch: "الدمام", customerName: "رضا عبدالهادي عيدة", service: "باقي الأتعاب", amount: 5000, paymentMethod: "الإنماء" },
  { receiptNo: "9380", date: "2026-06-15", branch: "الدمام", customerName: "علي احمد حسن العامري", service: "دفعة من الأتعاب", amount: 1000, paymentMethod: "نقداً" },

  // ===== فرع الرياض =====
  { receiptNo: "7551", date: "2026-03-29", branch: "الرياض", customerName: "ظافر علي الشهري", service: "المتبقي من العقد الأول", amount: 1000, paymentMethod: "الأهلي", employee: "عبدالله" },
  { receiptNo: "7552", date: "2026-03-29", branch: "الرياض", customerName: "صبحي خالد", service: "استشارة قانونية", amount: 250, paymentMethod: "الإنماء", employee: "مصلاح" },
  { receiptNo: "7553", date: "2026-03-31", branch: "الرياض", customerName: "راكان محمد السيف", service: "استشارة قانونية", amount: 250, paymentMethod: "مدى", employee: "مصلاح" },
  { receiptNo: "7554", date: "2026-03-31", branch: "الرياض", customerName: "خالد محمد السيد", service: "مقدم أتعاب", amount: 12000, paymentMethod: "مدى", employee: "عبدالله" },
  { receiptNo: "7555", date: "2026-04-01", branch: "الرياض", customerName: "راغب سليم", service: "استشارة قانونية", amount: 250, paymentMethod: "الأهلي", employee: "مصلاح" },
  { receiptNo: "7556", date: "2026-04-02", branch: "الرياض", customerName: "محمود المصطفى", service: "استشارة قانونية", amount: 250, paymentMethod: "الرياض", employee: "مصلاح" },
  { receiptNo: "7557", date: "2026-04-02", branch: "الرياض", customerName: "هاتان ذعار", service: "دفعة من الأتعاب", amount: 2500, paymentMethod: "الأهلي", employee: "عبدالرحمن" },
  { receiptNo: "7558", date: "2026-04-02", branch: "الرياض", customerName: "اكرم طمبان", service: "دفعة من الأتعاب", amount: 2000, paymentMethod: "الأهلي", employee: "ريان" },
  { receiptNo: "7559", date: "2026-04-02", branch: "الرياض", customerName: "في بابلين", service: "استشارة قانونية", amount: 250, paymentMethod: "الإنماء", employee: "ريان" },
  { receiptNo: "7560", date: "2026-04-02", branch: "الرياض", customerName: "ايمان الجزري", service: "استشارة قانونية", amount: 250, paymentMethod: "مدى", employee: "مصلاح" },
  { receiptNo: "7561", date: "2026-04-02", branch: "الرياض", customerName: "عبدالله بن باز", service: "استشارة قانونية", amount: 250, paymentMethod: "الإنماء", employee: "عبدالله" },
  { receiptNo: "7562", date: "2026-04-02", branch: "الرياض", customerName: "شركة حل التنمية", service: "دفعة من الأتعاب", amount: 1000, paymentMethod: "الإنماء", employee: "عبدالله" },
  { receiptNo: "7563", date: "2026-04-05", branch: "الرياض", customerName: "نادين العامري", service: "دفعة من الأتعاب", amount: 2500, paymentMethod: "الإنماء", employee: "عبدالله" },
  { receiptNo: "7564", date: "2026-04-05", branch: "الرياض", customerName: "وفاء محمد", service: "مقدم أتعاب", amount: 3000, paymentMethod: "مدى", employee: "مصلاح" },
  { receiptNo: "7565", date: "2026-04-05", branch: "الرياض", customerName: "عهود الرحيلي", service: "مقدم أتعاب", amount: 3000, paymentMethod: "مدى", employee: "عبدالله" },
  { receiptNo: "7566", date: "2026-04-05", branch: "الرياض", customerName: "همام الغزالي", service: "دفعة من الأتعاب", amount: 3000, paymentMethod: "كاش", employee: "عبدالله" },
  { receiptNo: "7567", date: "2026-04-05", branch: "الرياض", customerName: "همام الغزالي", service: "دفعة من الأتعاب", amount: 3000, paymentMethod: "كاش", employee: "عبدالله" },
  { receiptNo: "7568", date: "2026-04-05", branch: "الرياض", customerName: "وفاء الحديد", service: "دفعة من الأتعاب", amount: 5000, paymentMethod: "الأهلي", employee: "عبدالله" },
  { receiptNo: "7569", date: "2026-04-05", branch: "الرياض", customerName: "احمد كمال", service: "استشارة قانونية", amount: 250, paymentMethod: "مدى", employee: "مصلاح" },
  { receiptNo: "7570", date: "2026-04-06", branch: "الرياض", customerName: "شركة مجالات التقنية", service: "دفعة من الأتعاب", amount: 8000, paymentMethod: "الأهلي", employee: "عبدالله" },
  { receiptNo: "7571", date: "2026-04-06", branch: "الرياض", customerName: "نورة عبدالمحسن", service: "استشارة قانونية", amount: 200, paymentMethod: "الإنماء", employee: "مصلاح" },
  { receiptNo: "7572", date: "2026-04-07", branch: "الرياض", customerName: "محمد علي مصطفى", service: "دفعة من الأتعاب", amount: 3000, paymentMethod: "الأهلي", employee: "عبدالله" },
  { receiptNo: "7573", date: "2026-04-26", branch: "الرياض", customerName: "مريم عروم", service: "استشارة قانونية", amount: 250, paymentMethod: "الإنماء", employee: "عبدالله" },
  { receiptNo: "7574", date: "2026-04-26", branch: "الرياض", customerName: "امجاد السيد", service: "مقدم أتعاب", amount: 3000, paymentMethod: "مدى", employee: "مصلاح" },

  // ===== فرع جدة =====
  { receiptNo: "7651", date: "2026-05-14", branch: "جدة", customerName: "شركة بلارا بريميوم", service: "استشارة مكتوبة", amount: 6000, paymentMethod: "الإنماء", employee: "عبدالله الدرعمي", notes: "عميل خارجي خاص" },
  { receiptNo: "7652", date: "2026-05-14", branch: "جدة", customerName: "محمد ابراهيم عبيري", service: "مقدم أتعاب عقد", amount: 3000, paymentMethod: "مدى", employee: "مصطفى", notes: "تم" },
  { receiptNo: "7653", date: "2026-05-14", branch: "جدة", customerName: "فهد خالف الطلوي المطيري", service: "مقدم أتعاب", amount: 1000, paymentMethod: "مدى", employee: "مصطفى", notes: "مرتجع" },
  { receiptNo: "7654", date: "2026-05-14", branch: "جدة", customerName: "وسام خالد خان", service: "مقدم أتعاب", amount: 2500, paymentMethod: "مدى", employee: "خالد السلمي", notes: "تم" },
  { receiptNo: "7655", date: "2026-05-17", branch: "جدة", customerName: "علي فيضي", service: "مقدم أتعاب", amount: 5000, paymentMethod: "مدى", employee: "مصطفى", notes: "تم" },
  { receiptNo: "7656", date: "2026-05-17", branch: "جدة", customerName: "رندا سالم", service: "استشارة هاتفية", amount: 250, paymentMethod: "الأهلي", employee: "خالد السلمي" },
  { receiptNo: "7657", date: "2026-05-17", branch: "جدة", customerName: "عادل محرم", service: "استشارة هاتفية", amount: 300, paymentMethod: "الأهلي", employee: "خالد السلمي" },
  { receiptNo: "7658", date: "2026-05-17", branch: "جدة", customerName: "حمد المري", service: "استشارة قانونية", amount: 250, paymentMethod: "الرياض", employee: "خالد السلمي" },
  { receiptNo: "7659", date: "2026-05-18", branch: "جدة", customerName: "حسن زايد", service: "جزء من الأتعاب", amount: 5000, paymentMethod: "الأهلي", employee: "عبدالله الدرعمي" },
  { receiptNo: "7660", date: "2026-05-19", branch: "جدة", customerName: "سعود البقمي", service: "استشارة هاتفية", amount: 250, paymentMethod: "الإنماء", employee: "مصطفى" },
  { receiptNo: "7661", date: "2026-05-19", branch: "جدة", customerName: "مرام الشهري", service: "استشارة هاتفية", amount: 250, paymentMethod: "الإنماء", employee: "عبدالله الدرعمي" },
  { receiptNo: "7662", date: "2026-05-19", branch: "جدة", customerName: "عبدالله عزمان عبدالله علي العمري", service: "مقدم أتعاب عقد", amount: 5000, paymentMethod: "كاش", employee: "عبدالله الدرعمي", notes: "تم" },
  { receiptNo: "7663", date: "2026-05-19", branch: "جدة", customerName: "سعيد يحيى سعيد القاسم الزهراني", service: "مقدم أتعاب عقد", amount: 5000, paymentMethod: "مدى", employee: "مصطفى", notes: "تم" },
  { receiptNo: "7664", date: "2026-05-20", branch: "جدة", customerName: "حميد الفريفري", service: "مقدم أتعاب عقد", amount: 5000, paymentMethod: "الأهلي", employee: "مصطفى", notes: "تم" },

  // ===== فرع المدينة =====
  { receiptNo: "8201", date: "2026-05-05", branch: "المدينة", customerName: "راند بريك", service: "استشارة هاتفية", amount: 250, paymentMethod: "الأهلي" },
  { receiptNo: "8202", date: "2026-05-05", branch: "المدينة", customerName: "فيصل العنزي", service: "استشارة هاتفية", amount: 250, paymentMethod: "الإنماء" },
  { receiptNo: "8203", date: "2026-05-07", branch: "المدينة", customerName: "محمد عبد الرازق", service: "استشارة حضورية", amount: 300, paymentMethod: "مدى", notes: "200 مدى ودفع 100 كاش" },
  { receiptNo: "8204", date: "2026-05-10", branch: "المدينة", customerName: "محمد الموسى", service: "استشارة هاتفية", amount: 250, paymentMethod: "الأهلي" },
  { receiptNo: "8205", date: "2026-05-12", branch: "المدينة", customerName: "وليد مالك دراز", service: "استشارة حضورية", amount: 300, paymentMethod: "مدى" },
  { receiptNo: "8206", date: "2026-05-13", branch: "المدينة", customerName: "فهد ناشي", service: "استشارة حضورية بموعد", amount: 300, paymentMethod: "مدى" },
  { receiptNo: "8207", date: "2026-05-18", branch: "المدينة", customerName: "هاجر متعب", service: "استشارة هاتفية", amount: 250, paymentMethod: "الإنماء" },
  { receiptNo: "8208", date: "2026-06-08", branch: "المدينة", customerName: "منا عبدالمعبود اب البشر", service: "دفعة من اتعاب", amount: 1100, paymentMethod: "كاش", notes: "350 ريال راتب العامل لشهر 5" },
  { receiptNo: "8209", date: "2026-06-09", branch: "المدينة", customerName: "منا عبدالمعبود اب البشر", service: "دفعه من اتعاب", amount: 400, paymentMethod: "كاش" },
  { receiptNo: "8210", date: "2026-06-14", branch: "المدينة", customerName: "موسى الصبيح", service: "مقدم عقد", amount: 7500, paymentMethod: "الرياض", notes: "300 عموله زيد" },
  { receiptNo: "8211", date: "2026-06-18", branch: "المدينة", customerName: "عيسى جيمان", service: "مقدم عقد", amount: 2500, paymentMethod: "الأهلي" },
  { receiptNo: "8212", date: "2026-06-23", branch: "المدينة", customerName: "تي اس كي العربية", service: "كامل العقد", amount: 25000, paymentMethod: "الأهلي" },
];
