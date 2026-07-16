import { google } from 'googleapis';
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: "1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk",
  range: `يونيو!A4:K8`,
  valueRenderOption: "FORMATTED_VALUE",
});
const rows = res.data.values ?? [];
rows.forEach((row, i) => {
  console.log(`الصف ${i+4}:`);
  row.forEach((cell, j) => {
    const col = String.fromCharCode(65 + j); // A, B, C...
    if (cell) console.log(`  ${col}(${j}) = "${cell}"`);
  });
});
