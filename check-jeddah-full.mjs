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
const parseAmount = (s) => {
  const cleaned = (s || "").replace(/[,،\s]/g, "").replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
};

let count = 0, total = 0, skipped = 0;
for (const row of rows) {
  const amount = parseAmount(row[5] ?? "");
  const receiptRaw = (row[1] ?? "").toString().trim();
  const dateRaw = (row[2] ?? "").toString().trim();
  if (amount > 0) { count++; total += amount; }
  else if (receiptRaw && dateRaw) { count++; }
  else { skipped++; }
}

console.log("=== جدة - يونيو ===");
console.log(`✅ عدد السندات: ${count}`);
console.log(`💰 إجمالي المبلغ: ${total.toLocaleString("ar-SA")} ر.س`);
console.log(`⏭️ صفوف فارغة متجاوزة: ${skipped}`);
console.log(`📊 إجمالي الصفوف المقروءة: ${rows.length}`);
