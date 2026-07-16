import { google } from "googleapis";

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

const BRANCHES = [
  {
    branch: "جدة",
    id: "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk",
    colMap: { receiptNo: 1, date: 2, amount: 5 },
  },
  {
    branch: "الدمام",
    id: "1jmamIOkb2_1ZnL0_M6fQJBaSBsyiy-mkACOhs6F30T8",
    colMap: { receiptNo: 1, date: 2, amount: 5 },
  },
  {
    branch: "الرياض",
    id: "1WaOuBMdL42H-x_iGlaJeRgghxYWU7AxaGM7CZrVF1-Y",
    colMap: { receiptNo: 1, date: 2, amount: 5 },
  },
  {
    branch: "المدينة",
    id: "1RAVd4h1fxr-i4Bwlw7m867JWsnWvLU0uw7e0WKTOoR4",
    colMap: { receiptNo: 1, date: 2, amount: 5 },
  },
];

for (const cfg of BRANCHES) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: cfg.id,
    range: "يونيو!A5:K1000",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = res.data.values ?? [];
  let accepted = 0, totalAmount = 0;
  let prefilledCount = 0; // أرقام محجوزة بدون بيانات

  for (const row of rows) {
    const receiptRaw = (row[cfg.colMap.receiptNo] ?? "").toString().trim();
    const dateRaw    = (row[cfg.colMap.date] ?? "").toString().trim();
    const amountRaw  = (row[cfg.colMap.amount] ?? "").toString().trim();

    if (!receiptRaw && !dateRaw && !amountRaw) continue; // صف فارغ كلياً

    if (!receiptRaw || !dateRaw || !amountRaw) {
      prefilledCount++; // رقم محجوز بدون بيانات
    } else {
      accepted++;
      const cleaned = amountRaw.replace(/[,،\s]/g, "").replace(/[^0-9.]/g, "");
      totalAmount += parseFloat(cleaned) || 0;
    }
  }

  console.log(`\n=== ${cfg.branch} ===`);
  console.log(`✅ سندات مكتملة: ${accepted}`);
  console.log(`⚠️  أرقام محجوزة (بدون بيانات): ${prefilledCount}`);
  console.log(`💰 إجمالي المبلغ: ${totalAmount.toLocaleString("ar-SA")} ر.س`);
}
