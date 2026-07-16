import { google } from 'googleapis';

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });

const configs = [
  { branch: "الدمام",  id: "1jmamIOkb2_1ZnL0_M6fQJBaSBsyiy-mkACOhs6F30T8",
    colMap: { receiptNo:1, date:2, customerName:3, service:4, amount:5, paymentMethod:6, notes:7, employee:-1 },
    defaultEmployee: "موظف الدمام" },
  { branch: "الرياض",  id: "1WaOuBMdL42H-x_iGlaJeRgghxYWU7AxaGM7CZrVF1-Y",
    colMap: { receiptNo:1, date:2, customerName:3, service:4, amount:5, paymentMethod:6, employee:7, notes:8 },
    defaultEmployee: "" },
  { branch: "جدة",     id: "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk",
    colMap: { receiptNo:1, date:2, customerName:3, service:4, amount:5, paymentMethod:6, notes:7, employee:8 },
    defaultEmployee: "" },
  { branch: "المدينة", id: "1RAVd4h1fxr-i4Bwlw7m867JWsnWvLU0uw7e0WKTOoR4",
    colMap: { receiptNo:1, date:2, customerName:3, service:4, amount:5, paymentMethod:6, notes:7, employee:-1 },
    defaultEmployee: "موظف المدينة" },
];

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const currentMonth = ARABIC_MONTHS[new Date().getMonth()];
console.log(`📅 الشهر الحالي: ${currentMonth}\n`);

function parseAmount(raw) {
  const cleaned = String(raw).replace(/[,،\s]/g, "").replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

for (const cfg of configs) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: cfg.id,
      range: `${currentMonth}!A5:K20`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = res.data.values ?? [];
    const dataRows = rows.filter(row => {
      const amt = parseAmount(String(row[cfg.colMap.amount] ?? ''));
      return amt > 0;
    });
    
    const total = dataRows.reduce((s, r) => s + parseAmount(String(r[cfg.colMap.amount] ?? '')), 0);
    
    console.log(`✅ فرع ${cfg.branch}: ${dataRows.length} سند (من أول 16 صف)`);
    if (dataRows.length > 0) {
      const r = dataRows[0];
      const get = (i) => i >= 0 ? String(r[i] ?? '').trim() : cfg.defaultEmployee;
      console.log(`   أول سند: رقم=${get(cfg.colMap.receiptNo)} | تاريخ=${get(cfg.colMap.date)} | عميل=${get(cfg.colMap.customerName)} | مبلغ=${get(cfg.colMap.amount)} | دفع=${get(cfg.colMap.paymentMethod)} | موظف=${get(cfg.colMap.employee)}`);
    }
    console.log(`   💰 إجمالي (أول 16 صف): ${total.toLocaleString('ar-SA')} ر.س\n`);
  } catch (err) {
    console.error(`❌ ${cfg.branch}: ${err.message}\n`);
  }
}
