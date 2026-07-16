const { GoogleAuth } = require('./node_modules/.pnpm/google-auth-library@10.7.0/node_modules/google-auth-library/build/src/index.js');
const { google } = require('googleapis');

async function main() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const JEDDAH_ID = '1-iA45BIv0aoykYVFawTZC-2llhsQ_wjyNhrBjnlVtMk';
  const res = await sheets.spreadsheets.get({ spreadsheetId: JEDDAH_ID, fields: 'sheets.properties.title' });
  const names = res.data.sheets?.map(s => s.properties?.title) ?? [];
  console.log('أسماء التبويبات في جدة:', JSON.stringify(names));
}

main().catch(e => console.error('خطأ:', e.message));
