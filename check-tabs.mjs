import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });

const JEDDAH_ID = '1Mw1BxNHEHfLJFRlNTkQqmMhkJGiLVVIHIlKP0Ib3Qlk';
const res = await sheets.spreadsheets.get({ spreadsheetId: JEDDAH_ID, fields: 'sheets.properties.title' });
const names = res.data.sheets?.map(s => s.properties?.title) ?? [];
console.log('أسماء التبويبات في جدة:', JSON.stringify(names));
