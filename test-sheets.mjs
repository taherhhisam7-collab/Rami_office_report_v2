// اختبار الاتصال بـ Google Sheets API
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// نحتاج tsx لتشغيل TypeScript
import { execSync } from 'child_process';
try {
  const result = execSync(
    'node --import tsx/esm -e "' +
    "import { getAllBranchesData, getFilterOptions } from './server/sheetsClient.ts';" +
    "getFilterOptions().then(opts => { console.log(JSON.stringify(opts)); }).catch(e => { console.error('ERR:' + e.message); process.exit(1); })" +
    '"',
    { cwd: process.cwd(), timeout: 30000, encoding: 'utf8' }
  );
  console.log('Result:', result);
} catch (e) {
  console.error('Failed:', e.message);
}
