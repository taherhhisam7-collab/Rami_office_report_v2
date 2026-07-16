// اختبار مباشر لـ Google Sheets API بعد إصلاح dataStartRow=2
import { google } from 'googleapis';

const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  console.error("❌ GOOGLE_SERVICE_ACCOUNT_JSON غير موجود");
  process.exit(1);
}

const credentials = JSON.parse(serviceAccountJson);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// الجداول الأربعة مع dataStartRow=2
const configs = [
  { branch: "الدمام",  id: "1jmamIOkb2_1ZnL0_M6fQJBaSBsyiy-mkACOhs6F30T8" },
  { branch: "الرياض",  id: "1WaOuBMdL42H-x_iGlaJeRgghxYWU7AxaGM7CZrVF1-Y" },
  { branch: "جدة",     id: "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk" },
  { branch: "المدينة", id: "1RAVd4h1fxr-i4Bwlw7m867JWsnWvLU0uw7e0WKTOoR4" },
];

// الشهر الحالي
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const currentMonth = ARABIC_MONTHS[new Date().getMonth()];
console.log(`📅 الشهر الحالي: ${currentMonth}\n`);

for (const cfg of configs) {
  try {
    // قراءة الصف الأول (عناوين) + أول 3 صفوف بيانات
    const range = `${currentMonth}!A1:H5`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.id,
      range,
    });
    const rows = res.data.values ?? [];
    console.log(`✅ فرع ${cfg.branch}: ${rows.length} صفوف (بما فيها العناوين)`);
    if (rows.length > 0) {
      console.log(`   📋 الصف الأول (عناوين): [${rows[0]?.join(' | ')}]`);
    }
    if (rows.length > 1) {
      console.log(`   📄 الصف الثاني (أول بيانات): [${rows[1]?.join(' | ')}]`);
    }
    if (rows.length > 2) {
      console.log(`   📄 الصف الثالث: [${rows[2]?.join(' | ')}]`);
    }
    const dataRows = rows.slice(1); // بعد العناوين
    const totalAmount = dataRows.reduce((sum, row) => {
      const amount = parseFloat(String(row[4] ?? '0').replace(/,/g, '')) || 0;
      return sum + amount;
    }, 0);
    console.log(`   💰 إجمالي المبالغ (أول 4 صفوف): ${totalAmount.toLocaleString('ar-SA')} ر.س\n`);
  } catch (err) {
    console.error(`❌ فرع ${cfg.branch}: ${err.message}\n`);
  }
}
