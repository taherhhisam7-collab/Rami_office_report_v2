import { google } from "googleapis";

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

// جدة: colMap = { receiptNo:1, date:2, customerName:3, service:4, amount:5, paymentMethod:6, notes:7, employee:8 }
const id = "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk";

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: id,
  range: "يونيو!A5:K1000",
  valueRenderOption: "FORMATTED_VALUE",
});

const rows = res.data.values ?? [];
console.log(`إجمالي الصفوف من الصف 5: ${rows.length}\n`);

// الشرط الحالي: receiptNo + date + amount
let accepted = 0, rejected = 0;
let totalAmount = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const receiptRaw = (row[1] ?? "").toString().trim();
  const dateRaw    = (row[2] ?? "").toString().trim();
  const amountRaw  = (row[5] ?? "").toString().trim();

  if (!receiptRaw || !dateRaw || !amountRaw) {
    rejected++;
    // أظهر فقط الصفوف التي فيها شيء لكن تُرفض
    const hasAny = row.some(c => (c ?? "").toString().trim() !== "");
    if (hasAny) {
      console.log(`❌ صف ${i+5} مرفوض: رقم="${receiptRaw}" | تاريخ="${dateRaw}" | مبلغ="${amountRaw}" | كامل الصف: ${JSON.stringify(row)}`);
    }
  } else {
    accepted++;
    // تحليل المبلغ
    const cleaned = amountRaw.replace(/[,،\s]/g, "").replace(/[^0-9.]/g, "");
    const amount = parseFloat(cleaned) || 0;
    totalAmount += amount;
  }
}

console.log(`\n=== النتيجة ===`);
console.log(`✅ مقبول: ${accepted} سند`);
console.log(`❌ مرفوض: ${rejected} صف`);
console.log(`💰 إجمالي المبلغ: ${totalAmount.toLocaleString("ar-SA")} ر.س`);
